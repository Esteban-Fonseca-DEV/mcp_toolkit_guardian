// VIOLATION: DDD_MUTABLE_PUBLIC_STATE — public mutable property without readonly
export class Order {
  public status: string = "pending";  // violation: should be readonly or private
  public items: string[] = [];        // violation: should be readonly or private

  constructor(public readonly id: string) {}

  addItem(item: string): void {
    this.items.push(item);
  }
}
