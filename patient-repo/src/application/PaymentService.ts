/**
 * PaymentService handles payment processing logic.
 * NOTE: This file intentionally has NO corresponding .test.ts or .spec.ts file,
 * which triggers a MISSING_TEST violation from the tdd-strict agent.
 */
export class PaymentService {
  async processPayment(orderId: string, amount: number): Promise<{ success: boolean; transactionId: string }> {
    if (amount <= 0) {
      throw new Error("Amount must be positive");
    }

    // Simulated payment processing
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
    };
  }

  async refund(transactionId: string): Promise<{ success: boolean }> {
    return { success: true };
  }
}
