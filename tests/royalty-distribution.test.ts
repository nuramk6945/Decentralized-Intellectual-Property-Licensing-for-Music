import { describe, it, expect, beforeEach } from "vitest"

// Mock contract state
const mockContractState = {
  royaltyPayments: new Map(),
  paymentDistributions: new Map(),
  paymentTotalsByHolder: new Map(),
  admins: new Map(),
  paymentProcessors: new Map(),
  contractOwner: "deployer",
}

// Mock streaming tracking contract
const mockStreamingTracking = {
  getStreamingData(songId, platformId, reportingPeriod) {
    // For testing, we'll return verified data for keys that start with "verified-"
    const key = `${songId}:${platformId}:${reportingPeriod}`
    if (key.startsWith("verified-")) {
      return {
        playCount: 10000,
        revenueCents: 5000,
        verified: true,
      }
    } else if (key.startsWith("unverified-")) {
      return {
        playCount: 10000,
        revenueCents: 5000,
        verified: false,
      }
    }
    return null
  },
}

// Mock contract functions
const mockContract = {
  reset() {
    mockContractState.royaltyPayments.clear()
    mockContractState.paymentDistributions.clear()
    mockContractState.paymentTotalsByHolder.clear()
    mockContractState.admins.clear()
    mockContractState.paymentProcessors.clear()
    mockContractState.contractOwner = "deployer"
  },
  
  isAdmin(caller) {
    return caller === mockContractState.contractOwner || mockContractState.admins.get(caller) === true
  },
  
  isPaymentProcessor(caller) {
    return this.isAdmin(caller) || mockContractState.paymentProcessors.get(caller) === true
  },
  
  addAdmin(caller, newAdmin) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.admins.set(newAdmin, true)
    return { success: true }
  },
  
  removeAdmin(caller, admin) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.admins.delete(admin)
    return { success: true }
  },
  
  addPaymentProcessor(caller, processor) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.paymentProcessors.set(processor, true)
    return { success: true }
  },
  
  removePaymentProcessor(caller, processor) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.paymentProcessors.delete(processor)
    return { success: true }
  },
  
  createRoyaltyPayment(caller, paymentId, songId, platformId, reportingPeriod, totalAmount) {
    if (!this.isPaymentProcessor(caller)) {
      return { success: false, error: "ERR-NOT-PROCESSOR" }
    }
    
    if (mockContractState.royaltyPayments.has(paymentId)) {
      return { success: false, error: "ERR-PAYMENT-EXISTS" }
    }
    
    // Check if streaming data exists and is verified
    const streamingData = mockStreamingTracking.getStreamingData(songId, platformId, reportingPeriod)
    if (!streamingData) {
      return { success: false, error: "ERR-INVALID-PARAMETERS" }
    }
    
    if (!streamingData.verified) {
      return { success: false, error: "ERR-INVALID-PARAMETERS" }
    }
    
    mockContractState.royaltyPayments.set(paymentId, {
      songId: songId,
      platformId: platformId,
      reportingPeriod: reportingPeriod,
      totalAmount: totalAmount,
      paymentDate: Date.now(),
      status: "pending",
      transactionHash: null,
    })
    
    return { success: true }
  },
  
  addPaymentDistribution(caller, paymentId, rightsHolder, amount, percentage, rightsType) {
    if (!this.isPaymentProcessor(caller)) {
      return { success: false, error: "ERR-NOT-PROCESSOR" }
    }
    
    const payment = mockContractState.royaltyPayments.get(paymentId)
    if (!payment) {
      return { success: false, error: "ERR-PAYMENT-NOT-FOUND" }
    }
    
    const key = `${paymentId}:${rightsHolder}`
    if (mockContractState.paymentDistributions.has(key)) {
      return { success: false, error: "ERR-DISTRIBUTION-EXISTS" }
    }
    
    if (payment.status !== "pending") {
      return { success: false, error: "ERR-PAYMENT-NOT-PENDING" }
    }
    
    mockContractState.paymentDistributions.set(key, {
      amount: amount,
      percentage: percentage,
      rightsType: rightsType,
      status: "pending",
      distributionDate: null,
    })
    
    return { success: true }
  },
  
  processRoyaltyPayment(caller, paymentId, transactionHash) {
    if (!this.isPaymentProcessor(caller)) {
      return { success: false, error: "ERR-NOT-PROCESSOR" }
    }
    
    const payment = mockContractState.royaltyPayments.get(paymentId)
    if (!payment) {
      return { success: false, error: "ERR-PAYMENT-NOT-FOUND" }
    }
    
    if (payment.status !== "pending") {
      return { success: false, error: "ERR-PAYMENT-NOT-PENDING" }
    }
    
    mockContractState.royaltyPayments.set(paymentId, {
      ...payment,
      status: "completed",
      transactionHash: transactionHash,
    })
    
    return { success: true }
  },
  
  processDistribution(caller, paymentId, rightsHolder) {
    if (!this.isPaymentProcessor(caller)) {
      return { success: false, error: "ERR-NOT-PROCESSOR" }
    }
    
    const key = `${paymentId}:${rightsHolder}`
    const distribution = mockContractState.paymentDistributions.get(key)
    if (!distribution) {
      return { success: false, error: "ERR-DISTRIBUTION-NOT-FOUND" }
    }
    
    if (distribution.status !== "pending") {
      return { success: false, error: "ERR-DISTRIBUTION-NOT-PENDING" }
    }
    
    // Update holder totals
    const holderTotals = mockContractState.paymentTotalsByHolder.get(rightsHolder) || {
      totalPaid: 0,
      lastPaymentDate: null,
    }
    mockContractState.paymentTotalsByHolder.set(rightsHolder, {
      totalPaid: holderTotals.totalPaid + distribution.amount,
      lastPaymentDate: Date.now(),
    })
    
    // Update distribution status
    mockContractState.paymentDistributions.set(key, {
      ...distribution,
      status: "paid",
      distributionDate: Date.now(),
    })
    
    return { success: true }
  },
  
  getRoyaltyPayment(paymentId) {
    return mockContractState.royaltyPayments.get(paymentId)
  },
  
  getPaymentDistribution(paymentId, rightsHolder) {
    const key = `${paymentId}:${rightsHolder}`
    return mockContractState.paymentDistributions.get(key)
  },
  
  getPaymentTotals(rightsHolder) {
    return mockContractState.paymentTotalsByHolder.get(rightsHolder) || { totalPaid: 0, lastPaymentDate: null }
  },
}

describe("Royalty Distribution Contract", () => {
  beforeEach(() => {
    // Reset the mock state before each test
    mockContract.reset()
  })
  
  it("should allow admin to add a payment processor", () => {
    // Arrange
    const deployer = "deployer"
    const processor = "wallet_1"
    
    // Act
    const result = mockContract.addPaymentProcessor(deployer, processor)
    
    // Assert
    expect(result.success).toBe(true)
    expect(mockContract.isPaymentProcessor(processor)).toBe(true)
  })
  
  it("should allow payment processor to create a royalty payment", () => {
    // Arrange
    const deployer = "deployer"
    const processor = "wallet_1"
    const paymentId = "payment-123"
    const songId = "verified-song-123"
    const platformId = "verified-platform-123"
    const reportingPeriod = "verified-2023-01"
    const totalAmount = 5000 // $50.00
    
    // Add payment processor
    mockContract.addPaymentProcessor(deployer, processor)
    
    // Act
    const result = mockContract.createRoyaltyPayment(
        processor,
        paymentId,
        songId,
        platformId,
        reportingPeriod,
        totalAmount,
    )
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify payment was created
    const payment = mockContract.getRoyaltyPayment(paymentId)
    expect(payment).toBeDefined()
    expect(payment.songId).toBe(songId)
    expect(payment.totalAmount).toBe(totalAmount)
    expect(payment.status).toBe("pending")
  })
  
  it("should not allow creating payment for unverified streaming data", () => {
    // Arrange
    const deployer = "deployer"
    const processor = "wallet_1"
    const paymentId = "payment-123"
    const songId = "unverified-song-123"
    const platformId = "unverified-platform-123"
    const reportingPeriod = "unverified-2023-01"
    const totalAmount = 5000
    
    // Add payment processor
    mockContract.addPaymentProcessor(deployer, processor)
    
    // Act
    const result = mockContract.createRoyaltyPayment(
        processor,
        paymentId,
        songId,
        platformId,
        reportingPeriod,
        totalAmount,
    )
    
    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe("ERR-INVALID-PARAMETERS")
  })
  
  it("should allow payment processor to add a payment distribution", () => {
    // Arrange
    const deployer = "deployer"
    const processor = "wallet_1"
    const paymentId = "payment-123"
    const rightsHolder = "wallet_2"
    const songId = "verified-song-123"
    const platformId = "verified-platform-123"
    const reportingPeriod = "verified-2023-01"
    const totalAmount = 5000
    const amount = 2500 // $25.00
    const percentage = 5000 // 50%
    const rightsType = "performance"
    
    // Add payment processor and create payment
    mockContract.addPaymentProcessor(deployer, processor)
    mockContract.createRoyaltyPayment(processor, paymentId, songId, platformId, reportingPeriod, totalAmount)
    
    // Act
    const result = mockContract.addPaymentDistribution(
        processor,
        paymentId,
        rightsHolder,
        amount,
        percentage,
        rightsType,
    )
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify distribution was added
    const distribution = mockContract.getPaymentDistribution(paymentId, rightsHolder)
    expect(distribution).toBeDefined()
    expect(distribution.amount).toBe(amount)
    expect(distribution.percentage).toBe(percentage)
    expect(distribution.status).toBe("pending")
  })
  
  it("should allow payment processor to process a royalty payment", () => {
    // Arrange
    const deployer = "deployer"
    const processor = "wallet_1"
    const paymentId = "payment-123"
    const songId = "verified-song-123"
    const platformId = "verified-platform-123"
    const reportingPeriod = "verified-2023-01"
    const totalAmount = 5000
    const transactionHash = new Uint8Array([1, 2, 3, 4, 5])
    
    // Add payment processor and create payment
    mockContract.addPaymentProcessor(deployer, processor)
    mockContract.createRoyaltyPayment(processor, paymentId, songId, platformId, reportingPeriod, totalAmount)
    
    // Act
    const result = mockContract.processRoyaltyPayment(processor, paymentId, transactionHash)
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify payment was processed
    const payment = mockContract.getRoyaltyPayment(paymentId)
    expect(payment.status).toBe("completed")
    expect(payment.transactionHash).toBe(transactionHash)
  })
  
  it("should allow payment processor to process a distribution", () => {
    // Arrange
    const deployer = "deployer"
    const processor = "wallet_1"
    const paymentId = "payment-123"
    const rightsHolder = "wallet_2"
    const songId = "verified-song-123"
    const platformId = "verified-platform-123"
    const reportingPeriod = "verified-2023-01"
    const totalAmount = 5000
    const amount = 2500
    const percentage = 5000
    const rightsType = "performance"
    
    // Add payment processor, create payment, and add distribution
    mockContract.addPaymentProcessor(deployer, processor)
    mockContract.createRoyaltyPayment(processor, paymentId, songId, platformId, reportingPeriod, totalAmount)
    mockContract.addPaymentDistribution(processor, paymentId, rightsHolder, amount, percentage, rightsType)
    
    // Act
    const result = mockContract.processDistribution(processor, paymentId, rightsHolder)
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify distribution was processed
    const distribution = mockContract.getPaymentDistribution(paymentId, rightsHolder)
    expect(distribution.status).toBe("paid")
    expect(distribution.distributionDate).toBeDefined()
    
    // Verify holder totals were updated
    const totals = mockContract.getPaymentTotals(rightsHolder)
    expect(totals.totalPaid).toBe(amount)
    expect(totals.lastPaymentDate).toBeDefined()
  })
})

