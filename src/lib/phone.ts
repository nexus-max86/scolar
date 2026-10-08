/** Normalise un numéro congolais pour WhatsApp : « 0812 345 678 » → « 243812345678 ». */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = "243" + digits.slice(1);
  if (digits.length === 9) digits = "243" + digits;
  return digits.length >= 11 ? digits : null;
}

export function whatsAppLink(phone: string | null | undefined, message: string): string {
  const number = toWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
