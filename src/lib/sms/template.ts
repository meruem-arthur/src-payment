/** Fills the {name} {reference} {items} {amount} {receipt} placeholders (every occurrence). */
export function renderSmsTemplate(template: string, v: { name: string; reference: string; items: string; amount: string; receipt: string }) {
  return template.split("{name}").join(v.name).split("{reference}").join(v.reference).split("{items}").join(v.items)
    .split("{amount}").join(v.amount).split("{receipt}").join(v.receipt);
}
