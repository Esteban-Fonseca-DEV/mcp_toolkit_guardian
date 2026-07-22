// This is an INTERNAL entity of the Order aggregate
// It should only be accessed through the Order aggregate root
export class OrderItem {
  constructor(
    public readonly productId: string,
    public readonly quantity: number
  ) {}
}
