import { describe, it, expect, beforeEach } from "vitest"

// Mock contract state
const mockContractState = {
  songs: new Map(),
  rightsSplits: new Map(),
  songVersions: new Map(),
  songCountByArtist: new Map(),
  admins: new Map(),
  verifiedArtists: new Map(),
  contractOwner: "deployer",
}

// Mock contract functions
const mockContract = {
  reset() {
    mockContractState.songs.clear()
    mockContractState.rightsSplits.clear()
    mockContractState.songVersions.clear()
    mockContractState.songCountByArtist.clear()
    mockContractState.admins.clear()
    mockContractState.verifiedArtists.clear()
    mockContractState.contractOwner = "deployer"
  },
  
  isAdmin(caller) {
    return caller === mockContractState.contractOwner || mockContractState.admins.get(caller) === true
  },
  
  isVerifiedArtist(caller) {
    return this.isAdmin(caller) || mockContractState.verifiedArtists.get(caller) === true
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
  
  addVerifiedArtist(caller, artist) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.verifiedArtists.set(artist, true)
    return { success: true }
  },
  
  removeVerifiedArtist(caller, artist) {
    if (!this.isAdmin(caller)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.verifiedArtists.delete(artist)
    return { success: true }
  },
  
  registerSong(caller, songId, title, artist, composer, publisher, releaseDate, isrc) {
    if (!this.isVerifiedArtist(caller)) {
      return { success: false, error: "ERR-NOT-VERIFIED-ARTIST" }
    }
    
    if (mockContractState.songs.has(songId)) {
      return { success: false, error: "ERR-SONG-EXISTS" }
    }
    
    // Update song count for artist
    const artistCount = mockContractState.songCountByArtist.get(artist) || { count: 0 }
    mockContractState.songCountByArtist.set(artist, { count: artistCount.count + 1 })
    
    // Register the song
    mockContractState.songs.set(songId, {
      title: title,
      artist: artist,
      composer: composer,
      publisher: publisher,
      releaseDate: releaseDate,
      isrc: isrc,
      registeredBy: caller,
      registrationDate: Date.now(),
      status: "active",
    })
    
    return { success: true }
  },
  
  updateSong(caller, songId, title, artist, composer, publisher, releaseDate, isrc, status) {
    const song = mockContractState.songs.get(songId)
    if (!song) {
      return { success: false, error: "ERR-SONG-NOT-FOUND" }
    }
    
    if (!this.isAdmin(caller) && song.registeredBy !== caller) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    mockContractState.songs.set(songId, {
      title: title,
      artist: artist,
      composer: composer,
      publisher: publisher,
      releaseDate: releaseDate,
      isrc: isrc,
      registeredBy: song.registeredBy,
      registrationDate: song.registrationDate,
      status: status,
    })
    
    return { success: true }
  },
  
  addRightsHolder(caller, songId, rightsHolder, percentage, rightsType) {
    const song = mockContractState.songs.get(songId)
    if (!song) {
      return { success: false, error: "ERR-SONG-NOT-FOUND" }
    }
    
    if (!this.isAdmin(caller) && song.registeredBy !== caller) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    const key = `${songId}:${rightsHolder}`
    if (mockContractState.rightsSplits.has(key)) {
      return { success: false, error: "ERR-RIGHTS-HOLDER-EXISTS" }
    }
    
    if (percentage > 10000) {
      return { success: false, error: "ERR-INVALID-PERCENTAGE" }
    }
    
    // In a real implementation, we would check total percentage
    // For simplicity, we're skipping that check
    
    mockContractState.rightsSplits.set(key, {
      percentage: percentage,
      rightsType: rightsType,
      addedDate: Date.now(),
      lastUpdated: Date.now(),
    })
    
    return { success: true }
  },
  
  updateRightsHolder(caller, songId, rightsHolder, percentage) {
    const song = mockContractState.songs.get(songId)
    if (!song) {
      return { success: false, error: "ERR-SONG-NOT-FOUND" }
    }
    
    if (!this.isAdmin(caller) && song.registeredBy !== caller) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    const key = `${songId}:${rightsHolder}`
    const rights = mockContractState.rightsSplits.get(key)
    if (!rights) {
      return { success: false, error: "ERR-RIGHTS-HOLDER-NOT-FOUND" }
    }
    
    if (percentage > 10000) {
      return { success: false, error: "ERR-INVALID-PERCENTAGE" }
    }
    
    // In a real implementation, we would check total percentage
    // For simplicity, we're skipping that check
    
    mockContractState.rightsSplits.set(key, {
      ...rights,
      percentage: percentage,
      lastUpdated: Date.now(),
    })
    
    return { success: true }
  },
  
  getSong(songId) {
    return mockContractState.songs.get(songId)
  },
  
  getRightsHolder(songId, rightsHolder) {
    const key = `${songId}:${rightsHolder}`
    return mockContractState.rightsSplits.get(key)
  },
  
  isSongActive(songId) {
    const song = mockContractState.songs.get(songId)
    return song && song.status === "active"
  },
}

describe("Song Registration Contract", () => {
  beforeEach(() => {
    // Reset the mock state before each test
    mockContract.reset()
  })
  
  it("should allow admin to add a verified artist", () => {
    // Arrange
    const deployer = "deployer"
    const artist = "wallet_1"
    
    // Act
    const result = mockContract.addVerifiedArtist(deployer, artist)
    
    // Assert
    expect(result.success).toBe(true)
    expect(mockContract.isVerifiedArtist(artist)).toBe(true)
  })
  
  it("should not allow non-admin to add a verified artist", () => {
    // Arrange
    const nonAdmin = "wallet_1"
    const artist = "wallet_2"
    
    // Act
    const result = mockContract.addVerifiedArtist(nonAdmin, artist)
    
    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe("ERR-NOT-AUTHORIZED")
    expect(mockContract.isVerifiedArtist(artist)).toBe(false)
  })
  
  it("should allow verified artist to register a song", () => {
    // Arrange
    const deployer = "deployer"
    const artist = "wallet_1"
    const songId = "song-123"
    const title = "My Amazing Song"
    const artistName = "Amazing Artist"
    const composer = "Amazing Composer"
    const publisher = "Amazing Publisher"
    const releaseDate = 20230101
    const isrc = "USRC12345678"
    
    // Add verified artist
    mockContract.addVerifiedArtist(deployer, artist)
    
    // Act
    const result = mockContract.registerSong(artist, songId, title, artistName, composer, publisher, releaseDate, isrc)
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify song was registered
    const song = mockContract.getSong(songId)
    expect(song).toBeDefined()
    expect(song.title).toBe(title)
    expect(song.artist).toBe(artistName)
    expect(song.status).toBe("active")
  })
  
  it("should not allow non-verified artist to register a song", () => {
    // Arrange
    const nonVerifiedArtist = "wallet_1"
    const songId = "song-123"
    const title = "My Amazing Song"
    const artistName = "Amazing Artist"
    const composer = "Amazing Composer"
    const publisher = "Amazing Publisher"
    const releaseDate = 20230101
    const isrc = "USRC12345678"
    
    // Act
    const result = mockContract.registerSong(
        nonVerifiedArtist,
        songId,
        title,
        artistName,
        composer,
        publisher,
        releaseDate,
        isrc,
    )
    
    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe("ERR-NOT-VERIFIED-ARTIST")
  })
  
  it("should allow song registrant to add rights holder", () => {
    // Arrange
    const deployer = "deployer"
    const artist = "wallet_1"
    const rightsHolder = "wallet_2"
    const songId = "song-123"
    const title = "My Amazing Song"
    const artistName = "Amazing Artist"
    const composer = "Amazing Composer"
    const publisher = "Amazing Publisher"
    const releaseDate = 20230101
    const isrc = "USRC12345678"
    const percentage = 5000 // 50%
    const rightsType = "performance"
    
    // Add verified artist and register song
    mockContract.addVerifiedArtist(deployer, artist)
    mockContract.registerSong(artist, songId, title, artistName, composer, publisher, releaseDate, isrc)
    
    // Act
    const result = mockContract.addRightsHolder(artist, songId, rightsHolder, percentage, rightsType)
    
    // Assert
    expect(result.success).toBe(true)
    
    // Verify rights holder was added
    const rights = mockContract.getRightsHolder(songId, rightsHolder)
    expect(rights).toBeDefined()
    expect(rights.percentage).toBe(percentage)
    expect(rights.rightsType).toBe(rightsType)
  })
  
  it("should not allow adding rights holder with percentage over 100%", () => {
    // Arrange
    const deployer = "deployer"
    const artist = "wallet_1"
    const rightsHolder = "wallet_2"
    const songId = "song-123"
    const title = "My Amazing Song"
    const artistName = "Amazing Artist"
    const composer = "Amazing Composer"
    const publisher = "Amazing Publisher"
    const releaseDate = 20230101
    const isrc = "USRC12345678"
    const percentage = 12000 // 120%
    const rightsType = "performance"
    
    // Add verified artist and register song
    mockContract.addVerifiedArtist(deployer, artist)
    mockContract.registerSong(artist, songId, title, artistName, composer, publisher, releaseDate, isrc)
    
    // Act
    const result = mockContract.addRightsHolder(artist, songId, rightsHolder, percentage, rightsType)
    
    // Assert
    expect(result.success).toBe(false)
    expect(result.error).toBe("ERR-INVALID-PERCENTAGE")
  })
})

