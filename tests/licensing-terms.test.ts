import { describe, it, expect, beforeEach } from "vitest"

// Mock contract state
const mockContractState = {
  licenseTemplates: new Map(),
  platformRates: new Map(),
  songLicenses: new Map(),
  admins: new Map(),
  licenseManagers: new Map(),
  contractOwner: "deployer",
  nextTemplateId: 1,
}

// Mock song registration contract
const mockSongRegistration = {
  isSongActive(songId) {
    // For testing, we'll consider songs with IDs starting with "active-" as active
    return songId.startsWith("active-")
  },
}

// Mock contract functions
const mockContract = {
  reset() {
    mockContractState.licenseTemplates.clear()
    mockContractState.platformRates.clear()
    mockContractState.songLicenses.clear()
    mockContractState.admins.clear()
    mockContractState.licenseManagers.clear()
    mockContractState.contractOwner = "deployer"
    mockContractState.nextTemplateId = 1
  },
  
  isAdmin(caller) {
    return caller === mockContractState.contractOwner || mockContractState.admins.get(caller) === true
  },
  
  isLicenseManager(caller) {
    return this.isAdmin(caller) || mockContractState.licenseManagers.get(caller) === true
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
  
  addLicenseManager(caller, manager) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.licenseManagers.set(manager, true)
    return { success: true }
  },
  
  removeLicenseManager(caller, manager) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.licenseManagers.delete(manager)
    return { success: true }
  },
  
  createLicenseTemplate(caller, name, description, licenseType, durationDays, territory, exclusive) {
    if (!this.isLicenseManager(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    const templateId = mockContractState.nextTemplateId
    mockContractState.nextTemplateId += 1
    
    mockContractState.licenseTemplates.set(templateId, {
      name: name,
      description: description,
      licenseType: licenseType,
      durationDays: durationDays,
      territory: territory,
      exclusive: exclusive,
      createdBy: caller,
      creationDate: Date.now(),
      active: true,
    })
    
    return { success: true, templateId: templateId }
  },
  
  updateLicenseTemplate(
      caller,
      templateId,
      name,
      description,
      licenseType,
      durationDays,
      territory,
      exclusive,
      active,
  ) {
    if (!this.isLicenseManager(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    const template = mockContractState.licenseTemplates.get(templateId)
    if (!template) {
      return { success: false, error: "ERR-TEMPLATE-NOT-FOUND" }
    }
    
    mockContractState.licenseTemplates.set(templateId, {
      name: name,
      description: description,
      licenseType: licenseType,
      durationDays: durationDays,
      territory: territory,
      exclusive: exclusive,
      createdBy: template.createdBy,
      creationDate: template.creationDate,
      active: active,
    })
    
    return { success: true }
  },
  
  addPlatformRate(caller, templateId, platformId, platformName, ratePerUse, minimumFee) {
    if (!this.isLicenseManager(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    if (!mockContractState.licenseTemplates.has(templateId)) {
      return { success: false, error: "ERR-TEMPLATE-NOT-FOUND" }
    }
    
    const key = `${templateId}:${platformId}`
    if (mockContractState.platformRates.has(key)) {
      return { success: false, error: "ERR-PLATFORM-EXISTS" }
    }
    
    mockContractState.platformRates.set(key, {
      platformName: platformName,
      ratePerUse: ratePerUse,
      minimumFee: minimumFee,
      addedDate: Date.now(),
    })
    
    return { success: true }
  },
  
  createSongLicense(caller, songId, licenseId, licensee, templateId, startDate, endDate, customTerms) {
    if (!this.isLicenseManager(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    if (!mockContractState.licenseTemplates.has(templateId)) {
      return { success: false, error: "ERR-TEMPLATE-NOT-FOUND" }
    }
    
    const key = `${songId}:${licenseId}`
    if (mockContractState.songLicenses.has(key)) {
      return { success: false, error: "ERR-LICENSE-EXISTS" }
    }
    
    if (startDate >= endDate) {
      return { success: false, error: "ERR-INVALID-PARAMETERS" }
    }
    
    // Check if song is active
    if (!mockSongRegistration.isSongActive(songId)) {
      return { success: false, error: "ERR-SONG-NOT-ACTIVE" }
    }
    
    mockContractState.songLicenses.set(key, {
      licensee: licensee,
      templateId: templateId,
      startDate: startDate,
      endDate: endDate,
      customTerms: customTerms,
      status: "active",
      createdDate: Date.now(),
    })
    
    return { success: true }
  },
  
  getLicenseTemplate(templateId) {
    return mockContractState.licenseTemplates.get(templateId)
  },
  
  getPlatformRate(templateId, platformId) {
    const key = `${templateId}:${platformId}`
    return mockContractState.platformRates.get(key)
  },
  
  getSongLicense(songId, licenseId) {
    const key = `${songId}:${licenseId}`
    return mockContractState.songLicenses.get(key)
  },
  
  isLicenseActive(songId, licenseId) {
    const key = `${songId}:${licenseId}`
    const license = mockContractState.songLicenses.get(key)
    
    if (!license) {
      return false
    }
    
    const now = Date.now()
    return license.status === "active" && now >= license.startDate && now <= license.endDate
  },
}

describe("Licensing Terms Contract", () => {
  beforeEach(() => {
    // Reset the mock state before each test
    mockContract.reset()
  })
  
  it("should allow admin to add a license manager", () => {
    // Arrange
    const deployer = "deployer"
    const manager = "wallet_1"
    
    // Act
    const result = mockContract.addLicenseManager(deployer, manager)
    
    // Assert
    expect(result.success).toBe(true)
    expect(mockContract.isLicenseManager(manager)).toBe(true)
  })
  
  it("should allow license manager to create a license template", () => {
    // Arrange
    const deployer = "deployer"
    const manager = "wallet_1"
    const name = "Streaming License"
    const description = "License for music streaming platforms"
    const licenseType = "streaming"
    const durationDays = 365
    const territory = "global"
    const exclusive = false
    
    // Add license manager
    mockContract.addLicenseManager(deployer, manager)
    
    // Act
    const result = mockContract.createLicenseTemplate(
        manager,
        name,
        description,
        licenseType,
        durationDays,
        territory,
        exclusive,
    )
    
    // Assert
    expect(result.success).toBe(true)
    expect(result.templateId).toBe(1)
    
    // Verify template was created
    const template = mockContract.getLicenseTemplate(result.templateId)
    expect(template).toBeDefined()
    expect(template.name).toBe(name)
    expect(template.licenseType).toBe(licenseType)
    expect(template.active).toBe(true)
  })
  
  it("should allow license manager to add platform rate", () => {
    // Arrange
    const deployer = "deployer"
    const manager = "wallet_1"
    const templateId = 1
    const platformId = "platform-123"
    const platformName = "Spotify"
    const ratePerUse = 50 // $0.50 per stream
    const minimumFee = 1000 // $10.00 minimum
    
    // Add license manager and create template
    mockContract.addLicenseManager(deployer, manager)
    mockContract.createLicenseTemplate(
        manager,
        "Streaming License",
        "License for music streaming platforms",
        "streaming",
        365,
        "global",
        false,
    )
    
    // Act
    const result = mockContract.addPlatformRate(manager, templateId, platformId, platformName, ratePerUse, minimumFee)
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify platform rate was added
    const rate = mockContract.getPlatformRate(templateId, platformId)
    expect(rate).toBeDefined()
    expect(rate.platformName).toBe(platformName)
    expect(rate.ratePerUse).toBe(ratePerUse)
    expect(rate.minimumFee).toBe(minimumFee)
  })
  
  it("should allow license manager to create a song license", () => {
    // Arrange
    const deployer = "deployer"
    const manager = "wallet_1"
    const licensee = "wallet_2"
    const songId = "active-song-123" // Note: starts with "active-" to pass the mock check
    const licenseId = "license-123"
    const templateId = 1
    const startDate = Date.now()
    const endDate = startDate + 365 * 24 * 60 * 60 * 1000 // 1 year from now
    const customTerms = "Custom terms for this license"
    
    // Add license manager and create template
    mockContract.addLicenseManager(deployer, manager)
    mockContract.createLicenseTemplate(
        manager,
        "Streaming License",
        "License for music streaming platforms",
        "streaming",
        365,
        "global",
        false,
    )
    
    // Act
    const result = mockContract.createSongLicense(
        manager,
        songId,
        licenseId,
        licensee,
        templateId,
        startDate,
        endDate,
        customTerms,
    )
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify license was created
    const license = mockContract.getSongLicense(songId, licenseId)
    expect(license).toBeDefined()
    expect(license.licensee).toBe(licensee)
    expect(license.templateId).toBe(templateId)
    expect(license.status).toBe("active")
    expect(license.customTerms).toBe(customTerms)
  })
  
  it("should not allow creating a license for an inactive song", () => {
    // Arrange
    const deployer = "deployer"
    const manager = "wallet_1"
    const licensee = "wallet_2"
    const songId = "inactive-song-123" // Note: doesn't start with "active-"
    const licenseId = "license-123"
    const templateId = 1
    const startDate = Date.now()
    const endDate = startDate + 365 * 24 * 60 * 60 * 1000 // 1 year from now
    const customTerms = "Custom terms for this license"
    
    // Add license manager and create template
    mockContract.addLicenseManager(deployer, manager)
    mockContract.createLicenseTemplate(
        manager,
        "Streaming License",
        "License for music streaming platforms",
        "streaming",
        365,
        "global",
        false,
    )
    
    // Act
    const result = mockContract.createSongLicense(
        manager,
        songId,
        licenseId,
        licensee,
        templateId,
        startDate,
        endDate,
        customTerms,
    )
    
    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe("ERR-SONG-NOT-ACTIVE")
  })
})

