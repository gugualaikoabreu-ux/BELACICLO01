export type StaticPixConfig = {
  key: string;
  merchantName: string;
  merchantCity: string;
};

function tag(id: string, value: string) {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error(`Campo PIX ${id} excede 99 bytes.`);
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

function normalizeEmvText(value: string, maxBytes: number, fieldName: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .'-]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  if (!normalized || new TextEncoder().encode(normalized).length > maxBytes) throw new Error(`${fieldName} PIX deve conter de 1 a ${maxBytes} caracteres válidos.`);
  return normalized;
}

export function crc16Ccitt(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function readEmvFields(value: string) {
  const bytes = new TextEncoder().encode(value);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const fields: { id: string; value: string }[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) throw new Error("Código PIX estático incompleto.");
    const id = decoder.decode(bytes.slice(offset, offset + 2));
    const lengthText = decoder.decode(bytes.slice(offset + 2, offset + 4));
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) throw new Error("Código PIX estático inválido.");
    const length = Number(lengthText);
    const start = offset + 4;
    const end = start + length;
    if (end > bytes.length) throw new Error("Código PIX estático incompleto.");
    fields.push({ id, value: decoder.decode(bytes.slice(start, end)) });
    offset = end;
  }
  return fields;
}

/** Validate a merchant-provided static BR Code that leaves the order amount to the payer. */
export function validateStaticPixCopyPaste(copyPaste: string) {
  const value = copyPaste.trim();
  const bytes = new TextEncoder().encode(value);
  if (!value || bytes.length > 512 || !/6304([A-F0-9]{4})$/i.test(value)) throw new Error("Código PIX estático inválido.");
  const checksum = value.slice(-4).toUpperCase();
  if (crc16Ccitt(value.slice(0, -4)) !== checksum) throw new Error("Código PIX estático com CRC inválido.");

  const fields = readEmvFields(value.slice(0, -8));
  const field = (id: string) => fields.find((item) => item.id === id)?.value;
  if (field("00") !== "01" || field("01") !== "11" || field("52") !== "0000" || field("53") !== "986" || field("58") !== "BR") {
    throw new Error("O código informado não é um BR Code PIX estático em reais.");
  }
  if (field("54") !== undefined) throw new Error("Use um QR Code estático sem valor fixo para pedidos com totais diferentes.");
  if (!field("59") || new TextEncoder().encode(field("59")!).length > 25 || !field("60") || new TextEncoder().encode(field("60")!).length > 15) {
    throw new Error("O código PIX estático não contém os dados obrigatórios do recebedor.");
  }

  const pixAccount = fields
    .filter((item) => Number(item.id) >= 26 && Number(item.id) <= 51)
    .map((item) => readEmvFields(item.value))
    .find((items) => items.some((item) => item.id === "00" && item.value === "br.gov.bcb.pix") && items.some((item) => item.id === "01" && item.value.length > 0));
  if (!pixAccount) throw new Error("O código não contém uma chave PIX no formato BR Code.");

  const additionalData = field("62");
  const transactionReference = additionalData ? readEmvFields(additionalData).find((item) => item.id === "05")?.value : undefined;
  if (!transactionReference || (transactionReference !== "***" && !/^[A-Za-z0-9]{1,25}$/.test(transactionReference))) {
    throw new Error("O código PIX estático não contém uma referência de transação válida.");
  }
  return value;
}

export function buildStaticPixPayload(config: StaticPixConfig, amountCents: number, txid: string) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("O valor do PIX deve ser positivo e informado em centavos.");
  if (!config.key || config.key.length > 77 || /[\u0000-\u0020\u007f]/.test(config.key)) throw new Error("Configure uma chave PIX válida e autorizada.");
  if (!/^[A-Z0-9]{1,25}$/.test(txid)) throw new Error("O identificador do PIX deve conter até 25 letras ou números maiúsculos.");

  const merchantName = normalizeEmvText(config.merchantName, 25, "Nome do recebedor");
  const merchantCity = normalizeEmvText(config.merchantCity, 15, "Cidade do recebedor");
  const amount = `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`;
  const merchantAccount = tag("00", "br.gov.bcb.pix") + tag("01", config.key);
  const additionalData = tag("05", txid);
  const payload = [
    tag("00", "01"),
    tag("01", "11"),
    tag("26", merchantAccount),
    tag("52", "0000"),
    tag("53", "986"),
    tag("54", amount),
    tag("58", "BR"),
    tag("59", merchantName),
    tag("60", merchantCity),
    tag("62", additionalData),
    "6304",
  ].join("");

  return `${payload}${crc16Ccitt(payload)}`;
}
