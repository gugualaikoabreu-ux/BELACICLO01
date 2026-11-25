import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPixPayment, getManualPixRecipientKey, getManualPixRecipientName, renderPixQrCodeDataUrl } from "@/lib/payments/service";
import { createPaymentRecord } from "@/lib/payments/repository";
import { PaymentUnavailableError } from "@/lib/payments/provider";
import { ShippingUnavailableError } from "@/lib/shipping/manual";
import { getCorreiosQuotes, hasCorreiosSettings } from "@/lib/shipping/correios";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { expirePendingReservations } from "@/lib/stock-reservations";
import { effectiveUnitPrice } from "@/lib/pricing";
import { CouponUnavailableError, lockAndValidateCoupon, reserveCouponForOrder } from "@/lib/coupons";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";
import { enqueueOrderEmail } from "@/lib/order-notifications";
import { createStableOrderNumber } from "@/lib/checkout/identifiers";
import { paymentReservationDurationMinutes } from "@/lib/payments/reservation-duration";
import { calculateCheckoutTotal } from "@/lib/checkout/totals";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";
import { buildConfiguredShippingOptions, attachCorreiosOptions, buildFreeShippingProductOption, isFreeShippingProductOrder, selectServerShippingOption, type ShippingOption } from "@/lib/shipping/options";
import { municipalitiesMatch } from "@/lib/shipping/regional";
import { CepLookupError, lookupViaCep } from "@/lib/address/cep";

const addressSchema = z.object({
  recipient: z.string().trim().min(2).max(120),
  postalCode: z.string().regex(/^\d{5}-?\d{3}$/).transform((value) => value.replace(/\D/g, "")),
  street: z.string().trim().min(2).max(180),
  number: z.string().trim().min(1).max(30),
  complement: z.string().trim().max(100).optional(),
  reference: z.string().trim().max(180).optional(),
  neighborhood: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
});
const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(30).transform((value) => value.replace(/\D/g, "")).refine((value) => value.length >= 10 && value.length <= 13, "Telefone inválido."),
  items: z.array(z.object({ variantId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(10) })).min(1).max(30),
  shippingServiceCode: z.string().regex(/^[A-Z0-9_:-]{1,48}$/).optional(),
  shippingAmountCents: z.number().int().nonnegative().optional(),
  couponCode: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/).optional(),
  address: addressSchema,
});

class CheckoutRequestError extends Error {
  constructor(message: string) { super(message); this.name = "CheckoutRequestError"; }
}

function reservationDurationMinutes() {
  return paymentReservationDurationMinutes(process.env.PAYMENT_RESERVATION_MINUTES);
}

function prismaErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL || !isSupabaseConfigured) return Response.json({ message: "Checkout indisponível até conectar o banco e o Supabase Auth." }, { status: 503 });
  if (!await enforceRateLimit("checkout", requestIp(request), 8, 60)) return Response.json({ message: "Muitas tentativas de checkout. Aguarde um minuto." }, { status: 429 });

  const user = await getCurrentUser();
  if (!user?.id || !user.email) return Response.json({ message: "Entre na sua conta para finalizar o pedido." }, { status: 401 });
  if (!user.email_confirmed_at) return Response.json({ message: "Confirme o endereço de e-mail antes de comprar." }, { status: 403 });
  const customerEmail = user.email.toLowerCase();

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (idempotencyKey.length < 16 || idempotencyKey.length > 120) return Response.json({ message: "Não foi possível identificar esta tentativa de compra. Tente novamente." }, { status: 400 });
  const orderNumber = createStableOrderNumber(user.id, idempotencyKey);
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "Confira os dados de entrega e os itens da sacola." }, { status: 400 });
  const variantIds = parsed.data.items.map((item) => item.variantId);
  if (new Set(variantIds).size !== variantIds.length) return Response.json({ message: "A sacola contém uma variação duplicada. Atualize e tente novamente." }, { status: 400 });

  let checkoutStage = "load_shipping_settings";
  try {
    const db = getDb();
    const storeSettings = await getStoreShippingSettings();
    checkoutStage = "load_product_variants";
    const quoteVariants = await db.productVariant.findMany({ where: { id: { in: variantIds }, active: true }, include: { product: true } });
    if (quoteVariants.length !== variantIds.length) throw new CheckoutRequestError("Uma das variações escolhidas não está disponível.");
    const quoteVariantById = new Map(quoteVariants.map((variant) => [variant.id, variant]));
    const quoteSubtotal = parsed.data.items.reduce((sum, item) => {
      const variant = quoteVariantById.get(item.variantId);
      if (!variant || !variant.product.active || variant.product.demo || variant.stock - variant.reserved < item.quantity) throw new CheckoutRequestError("Estoque insuficiente para uma das variações escolhidas.");
      return sum + effectiveUnitPrice(variant.product.price, variant.product.promotionalPrice) * item.quantity;
    }, 0);
    checkoutStage = "validate_destination_cep";
    let destination: { city: string; state: string } | null = null;
    try {
      destination = await lookupViaCep(parsed.data.address.postalCode);
      if (!municipalitiesMatch(destination.city, parsed.data.address.city) || destination.state !== parsed.data.address.state) {
        throw new CheckoutRequestError("A cidade e o estado precisam corresponder ao município confirmado pelo CEP. Revise o endereço e consulte o frete novamente.");
      }
    } catch (error) {
      if (error instanceof CheckoutRequestError) throw error;
      if (!(error instanceof CepLookupError) || error.kind !== "unavailable") throw new CheckoutRequestError("O CEP não foi encontrado. Confira o endereço antes de finalizar.");
    }

    const freeShippingForProduct = isFreeShippingProductOrder(parsed.data.items.map((item) => ({ productSlug: quoteVariantById.get(item.variantId)!.product.slug })));
    const shippingOptions = freeShippingForProduct
      ? [buildFreeShippingProductOption(storeSettings)]
      : buildConfiguredShippingOptions(storeSettings, destination, quoteSubtotal);
    if (!freeShippingForProduct && storeSettings.correiosShippingEnabled && hasCorreiosSettings()) {
      try {
        const quotes = await getCorreiosQuotes(parsed.data.address.postalCode, parsed.data.items, storeSettings.originPostalCode);
        shippingOptions.push(...attachCorreiosOptions([], quotes));
      } catch { /* Other configured shipping methods remain available. */ }
    }
    let selectedShipping: ShippingOption;
    try {
      selectedShipping = selectServerShippingOption(shippingOptions, parsed.data.shippingServiceCode, parsed.data.shippingAmountCents);
    } catch (error) {
      throw new ShippingUnavailableError(error instanceof Error ? error.message : "A tarifa de entrega não está disponível para este CEP.");
    }
    checkoutStage = "expire_old_reservations";
    const reservationMinutes = reservationDurationMinutes();
    await expirePendingReservations();
    checkoutStage = "save_customer";
    await db.user.upsert({
      where: { id: user.id },
      create: { id: user.id, name: parsed.data.customerName, email: customerEmail, emailVerified: true, phone: parsed.data.customerPhone },
      update: { email: customerEmail, emailVerified: true, phone: parsed.data.customerPhone },
    });

    const createOrderTransaction = () => db.$transaction(async (tx) => {
      checkoutStage = "check_idempotency";
      const existing = await tx.order.findUnique({ where: { idempotencyKey }, select: {
        id: true, userId: true, number: true, subtotal: true, discount: true, shipping: true, shippingServiceName: true,
        ...(storeSettings.orderDeliveryColumnsAvailable ? { shippingDeliveryMinDays: true, shippingDeliveryMaxDays: true } : {}),
        payments: { select: { paymentStatus: true, pixCopyPaste: true, amount: true, expiresAt: true } },
      } });
      if (existing) {
        if (existing.userId !== user.id) throw new CheckoutRequestError("Chave de checkout já utilizada.");
        const payment = existing.payments[0];
        if (!payment || !payment.pixCopyPaste || payment.paymentStatus !== "PENDING") throw new CheckoutRequestError("Este pedido não está aguardando pagamento.");
        return {
          order: existing,
          payment,
          shippingDeliveryMinDays: existing.shippingDeliveryMinDays ?? null,
          shippingDeliveryMaxDays: existing.shippingDeliveryMaxDays ?? null,
          pixRecipientName: getManualPixRecipientName(),
          qrCodeDataUrl: await renderPixQrCodeDataUrl(payment.pixCopyPaste),
        };
      }

      if (storeSettings.settingsTableAvailable) {
        const latestSettings = await tx.shippingSettings.findUnique({ where: { id: "store" }, select: { updatedAt: true } });
        if ((latestSettings?.updatedAt?.getTime() ?? null) !== (storeSettings.updatedAt?.getTime() ?? null)) {
          throw new ShippingUnavailableError("As regras de frete mudaram durante a finalização. Consulte o frete novamente.");
        }
      }

      checkoutStage = "recheck_stock_and_prices";
      const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds }, active: true }, include: { product: true } });
      if (variants.length !== variantIds.length) throw new CheckoutRequestError("Uma das variações escolhidas não está disponível.");
      const variantById = new Map(variants.map((variant) => [variant.id, variant]));
      const lines = parsed.data.items.map((item) => {
        const variant = variantById.get(item.variantId);
        if (!variant || !variant.product.active || variant.product.demo || variant.stock - variant.reserved < item.quantity) throw new CheckoutRequestError("Estoque insuficiente para uma das variações escolhidas.");
        const unitPrice = effectiveUnitPrice(variant.product.price, variant.product.promotionalPrice);
        return { variant, quantity: item.quantity, unitPrice, subtotal: unitPrice * item.quantity };
      });
      if (selectedShipping.method === "free_product" && !isFreeShippingProductOrder(lines.map((line) => ({ productSlug: line.variant.product.slug }))) ) {
        throw new ShippingUnavailableError("O frete grátis deste produto não se aplica aos itens atuais da sacola. Consulte o frete novamente.");
      }
      const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
      if (selectedShipping.method === "free_threshold" && (!storeSettings.freeShippingEnabled || storeSettings.freeShippingThresholdCents === null || subtotal < storeSettings.freeShippingThresholdCents)) {
        throw new ShippingUnavailableError("O subtotal mudou e o frete grátis não está mais disponível. Confira os valores da sacola.");
      }
      const finalShippingSelection = selectedShipping;
      const finalShippingCents = finalShippingSelection.shippingCents;
      const finalShippingServiceName = finalShippingSelection.name;
      const finalShippingServiceCode = finalShippingSelection.code;
      let couponQuote: Awaited<ReturnType<typeof lockAndValidateCoupon>> | null = null;
      if (parsed.data.couponCode) {
        checkoutStage = "validate_coupon";
        couponQuote = await lockAndValidateCoupon(tx, { code: parsed.data.couponCode, userId: user.id, subtotalCents: subtotal });
      }
      const discount = couponQuote?.discountCents ?? 0;
      const total = calculateCheckoutTotal(subtotal, discount, finalShippingCents);
      if (total === null) throw new CheckoutRequestError("O total do pedido precisa ser válido e maior que zero após o desconto e o frete.");
      const expiresAt = new Date(Date.now() + reservationMinutes * 60_000);
      checkoutStage = "build_pix_charge";
      const pix = await createPixPayment(total, orderNumber, expiresAt, customerEmail);

      checkoutStage = "reserve_stock";
      for (const line of lines) {
        const reserved = await tx.$executeRaw`UPDATE "product_variants" SET "reserved" = "reserved" + ${line.quantity}, "updatedAt" = NOW() WHERE "id" = ${line.variant.id} AND "active" = true AND "stock" - "reserved" >= ${line.quantity}`;
        if (reserved !== 1) throw new CheckoutRequestError("Outra compra reservou o estoque desta variação. Atualize a sacola.");
      }

      checkoutStage = "insert_order";
      const order = await tx.order.create({ data: {
        number: orderNumber,
        userId: user.id,
        customerName: parsed.data.customerName,
        customerEmail,
        customerPhone: parsed.data.customerPhone,
        status: "RECEIVED",
        paymentStatus: "PENDING",
        paymentMethod: "PIX",
        subtotal,
        shipping: finalShippingCents,
        shippingServiceCode: finalShippingServiceCode,
        shippingServiceName: finalShippingServiceName,
        ...(storeSettings.orderDeliveryColumnsAvailable ? {
          shippingDeliveryMinDays: finalShippingSelection.deliveryMinDays,
          shippingDeliveryMaxDays: finalShippingSelection.deliveryMaxDays,
        } : {}),
        discount,
        total,
        shippingAddress: parsed.data.address,
        idempotencyKey,
        items: { create: lines.map(({ variant, quantity, unitPrice, subtotal: itemSubtotal }) => ({ productId: variant.productId, variantId: variant.id, name: variant.product.name, size: variant.size, color: variant.color, unitPrice, quantity, subtotal: itemSubtotal })) },
        reservations: { create: lines.map(({ variant, quantity }) => ({ variantId: variant.id, quantity, expiresAt })) },
      }, select: {
        id: true,
        number: true,
        customerName: true,
        customerEmail: true,
        total: true,
        trackingCode: true,
        trackingUrl: true,
        subtotal: true,
        discount: true,
        shipping: true,
        shippingServiceName: true,
      } });
      if (couponQuote) {
        checkoutStage = "reserve_coupon";
        await reserveCouponForOrder(tx, { couponId: couponQuote.couponId, couponCode: couponQuote.code, orderId: order.id, userId: user.id, discountCents: couponQuote.discountCents, usageLimit: couponQuote.usageLimit });
      }
      checkoutStage = "insert_payment";
      const payment = await createPaymentRecord(tx, { orderId: order.id, provider: pix.provider, transactionId: pix.transactionId, amount: total, copyPaste: pix.copyPaste, qrCodeReference: pix.qrCodeReference, expiresAt });
      checkoutStage = "insert_payment_event";
      await tx.paymentEvent.create({ data: { provider: pix.provider, providerEventId: `created:${payment.id}`, paymentId: payment.id, orderId: order.id, amount: total, eventType: "CHARGE_CREATED", eventData: { reservationMinutes }, processedAt: new Date() } });
      // The actor attribution fields are added by a later optional migration.
      // Keep the new-order path compatible with the current store schema.
      checkoutStage = "insert_order_event";
      await tx.orderEvent.create({
        data: { orderId: order.id, status: "RECEIVED", note: `Pedido recebido; frete confirmado: ${finalShippingServiceName}. Aguardando confirmação do PIX.` },
        select: { id: true, orderId: true, status: true, note: true, createdAt: true },
      });
      checkoutStage = "enqueue_confirmation_email";
      await enqueueOrderEmail(tx, { ...order, total }, "received");
      return {
        order,
        payment,
        shippingDeliveryMinDays: storeSettings.orderDeliveryColumnsAvailable ? finalShippingSelection.deliveryMinDays : null,
        shippingDeliveryMaxDays: storeSettings.orderDeliveryColumnsAvailable ? finalShippingSelection.deliveryMaxDays : null,
        pixRecipientName: pix.recipientName,
        qrCodeDataUrl: pix.qrCodeDataUrl,
      };
    }, { isolationLevel: "Serializable" });

    let result: Awaited<ReturnType<typeof createOrderTransaction>>;
    try {
      checkoutStage = "create_order_transaction";
      result = await createOrderTransaction();
    } catch (error) {
      if (prismaErrorCode(error) !== "P2034") throw error;
      checkoutStage = "retry_serializable_transaction";
      result = await createOrderTransaction();
    }

    checkoutStage = "build_checkout_response";
    return Response.json({ orderNumber: result.order.number, subtotal: result.order.subtotal, discount: result.order.discount, shipping: result.order.shipping, shippingServiceName: result.order.shippingServiceName, shippingDeliveryMinDays: result.shippingDeliveryMinDays, shippingDeliveryMaxDays: result.shippingDeliveryMaxDays, total: result.payment.amount, paymentStatus: result.payment.paymentStatus, copyPaste: result.payment.pixCopyPaste, recipientKey: getManualPixRecipientKey(), recipientName: result.pixRecipientName, qrCodeDataUrl: result.qrCodeDataUrl, expiresAt: result.payment.expiresAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[checkout] Pedido não criado", {
      stage: checkoutStage,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: prismaErrorCode(error),
    });
    const isServiceError = error instanceof ShippingUnavailableError || error instanceof PaymentUnavailableError;
    const isCouponError = error instanceof CouponUnavailableError;
    const isRequestError = error instanceof CheckoutRequestError;
    const message = isServiceError || isCouponError || isRequestError ? error.message : "Não foi possível criar o pedido agora. Tente novamente.";
    const status = isServiceError ? 503 : isCouponError || isRequestError ? 409 : 503;
    return Response.json({ message }, { status });
  }
}
