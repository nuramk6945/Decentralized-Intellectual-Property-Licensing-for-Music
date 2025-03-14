;; Song Registration Contract
;; Records ownership and rights for musical works

;; Define data variables
(define-map songs
  { song-id: (string-ascii 36) }
  {
    title: (string-ascii 100),
    artist: (string-ascii 100),
    composer: (string-ascii 100),
    publisher: (string-ascii 100),
    release-date: uint,
    isrc: (string-ascii 12),  ;; International Standard Recording Code
    registered-by: principal,
    registration-date: uint,
    status: (string-ascii 20)  ;; active, inactive, disputed
  }
)

(define-map rights-splits
  {
    song-id: (string-ascii 36),
    rights-holder: principal
  }
  {
    percentage: uint,  ;; Percentage * 100 (e.g., 2500 = 25%)
    rights-type: (string-ascii 20),  ;; performance, mechanical, sync, etc.
    added-date: uint,
    last-updated: uint
  }
)

(define-map song-versions
  {
    song-id: (string-ascii 36),
    version-id: (string-ascii 36)
  }
  {
    version-type: (string-ascii 20),  ;; remix, cover, sample, etc.
    parent-song-id: (optional (string-ascii 36)),
    added-date: uint
  }
)

(define-map song-count-by-artist
  { artist: (string-ascii 100) }
  { count: uint }
)

(define-map admins principal bool)
(define-map verified-artists principal bool)

;; Define error codes
(define-constant ERR-NOT-AUTHORIZED u1)
(define-constant ERR-SONG-EXISTS u2)
(define-constant ERR-SONG-NOT-FOUND u3)
(define-constant ERR-INVALID-PARAMETERS u4)
(define-constant ERR-RIGHTS-HOLDER-EXISTS u5)
(define-constant ERR-RIGHTS-HOLDER-NOT-FOUND u6)
(define-constant ERR-VERSION-EXISTS u7)
(define-constant ERR-VERSION-NOT-FOUND u8)
(define-constant ERR-NOT-VERIFIED-ARTIST u9)
(define-constant ERR-INVALID-PERCENTAGE u10)

;; Initialize contract with contract deployer as admin
(define-data-var contract-owner principal tx-sender)

;; Check if caller is an admin
(define-read-only (is-admin)
  (or
    (is-eq tx-sender (var-get contract-owner))
    (default-to false (map-get? admins tx-sender))
  )
)

;; Add a new admin
(define-public (add-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-set admins new-admin true))
  )
)

;; Remove an admin
(define-public (remove-admin (admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-delete admins admin))
  )
)

;; Check if caller is a verified artist
(define-read-only (is-verified-artist)
  (or
    (is-admin)
    (default-to false (map-get? verified-artists tx-sender))
  )
)

;; Add a verified artist
(define-public (add-verified-artist (artist principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-set verified-artists artist true))
  )
)

;; Remove a verified artist
(define-public (remove-verified-artist (artist principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-delete verified-artists artist))
  )
)

;; Register a new song
(define-public (register-song
  (song-id (string-ascii 36))
  (title (string-ascii 100))
  (artist (string-ascii 100))
  (composer (string-ascii 100))
  (publisher (string-ascii 100))
  (release-date uint)
  (isrc (string-ascii 12))
)
  (begin
    (asserts! (is-verified-artist) (err ERR-NOT-VERIFIED-ARTIST))
    (asserts! (is-none (map-get? songs { song-id: song-id })) (err ERR-SONG-EXISTS))

    ;; Update song count for artist
    (let (
      (artist-count (default-to { count: u0 } (map-get? song-count-by-artist { artist: artist })))
    )
      (map-set song-count-by-artist
        { artist: artist }
        { count: (+ (get count artist-count) u1) }
      )
    )

    ;; Register the song
    (ok (map-set songs
      { song-id: song-id }
      {
        title: title,
        artist: artist,
        composer: composer,
        publisher: publisher,
        release-date: release-date,
        isrc: isrc,
        registered-by: tx-sender,
        registration-date: block-height,
        status: "active"
      }
    ))
  )
)

;; Update song details
(define-public (update-song
  (song-id (string-ascii 36))
  (title (string-ascii 100))
  (artist (string-ascii 100))
  (composer (string-ascii 100))
  (publisher (string-ascii 100))
  (release-date uint)
  (isrc (string-ascii 12))
  (status (string-ascii 20))
)
  (let (
    (song (unwrap! (map-get? songs { song-id: song-id }) (err ERR-SONG-NOT-FOUND)))
  )
    (asserts! (or (is-admin) (is-eq (get registered-by song) tx-sender)) (err ERR-NOT-AUTHORIZED))

    (ok (map-set songs
      { song-id: song-id }
      {
        title: title,
        artist: artist,
        composer: composer,
        publisher: publisher,
        release-date: release-date,
        isrc: isrc,
        registered-by: (get registered-by song),
        registration-date: (get registration-date song),
        status: status
      }
    ))
  )
)

;; Add rights holder to a song
(define-public (add-rights-holder
  (song-id (string-ascii 36))
  (rights-holder principal)
  (percentage uint)
  (rights-type (string-ascii 20))
)
  (begin
    (asserts! (is-some (map-get? songs { song-id: song-id })) (err ERR-SONG-NOT-FOUND))
    (asserts! (or (is-admin) (is-eq (get registered-by (unwrap-panic (map-get? songs { song-id: song-id }))) tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (map-get? rights-splits { song-id: song-id, rights-holder: rights-holder })) (err ERR-RIGHTS-HOLDER-EXISTS))
    (asserts! (<= percentage u10000) (err ERR-INVALID-PERCENTAGE))  ;; Max 100%

    ;; Validate total percentage doesn't exceed 100%
    (let (
      (total-percentage (+ percentage (get-total-rights-percentage song-id rights-type)))
    )
      (asserts! (<= total-percentage u10000) (err ERR-INVALID-PERCENTAGE))

      (ok (map-set rights-splits
        { song-id: song-id, rights-holder: rights-holder }
        {
          percentage: percentage,
          rights-type: rights-type,
          added-date: block-height,
          last-updated: block-height
        }
      ))
    )
  )
)

;; Update rights holder percentage
(define-public (update-rights-holder
  (song-id (string-ascii 36))
  (rights-holder principal)
  (percentage uint)
)
  (let (
    (rights (unwrap! (map-get? rights-splits { song-id: song-id, rights-holder: rights-holder }) (err ERR-RIGHTS-HOLDER-NOT-FOUND)))
    (song (unwrap! (map-get? songs { song-id: song-id }) (err ERR-SONG-NOT-FOUND)))
  )
    (asserts! (or (is-admin) (is-eq (get registered-by song) tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= percentage u10000) (err ERR-INVALID-PERCENTAGE))

    ;; Calculate new total percentage
    (let (
      (old-percentage (get percentage rights))
      (current-total (get-total-rights-percentage song-id (get rights-type rights)))
      (new-total (+ (- current-total old-percentage) percentage))
    )
      (asserts! (<= new-total u10000) (err ERR-INVALID-PERCENTAGE))

      (ok (map-set rights-splits
        { song-id: song-id, rights-holder: rights-holder }
        (merge rights {
          percentage: percentage,
          last-updated: block-height
        })
      ))
    )
  )
)

;; Remove rights holder
(define-public (remove-rights-holder
  (song-id (string-ascii 36))
  (rights-holder principal)
)
  (let (
    (song (unwrap! (map-get? songs { song-id: song-id }) (err ERR-SONG-NOT-FOUND)))
  )
    (asserts! (or (is-admin) (is-eq (get registered-by song) tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (map-get? rights-splits { song-id: song-id, rights-holder: rights-holder })) (err ERR-RIGHTS-HOLDER-NOT-FOUND))

    (ok (map-delete rights-splits { song-id: song-id, rights-holder: rights-holder }))
  )
)

;; Add a song version (remix, cover, etc.)
(define-public (add-song-version
  (song-id (string-ascii 36))
  (version-id (string-ascii 36))
  (version-type (string-ascii 20))
  (parent-song-id (optional (string-ascii 36)))
)
  (begin
    (asserts! (is-some (map-get? songs { song-id: song-id })) (err ERR-SONG-NOT-FOUND))
    (asserts! (or (is-admin) (is-eq (get registered-by (unwrap-panic (map-get? songs { song-id: song-id }))) tx-sender)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (map-get? song-versions { song-id: song-id, version-id: version-id })) (err ERR-VERSION-EXISTS))

    ;; If parent song is specified, verify it exists
    (if (is-some parent-song-id)
      (asserts! (is-some (map-get? songs { song-id: (unwrap-panic parent-song-id) })) (err ERR-SONG-NOT-FOUND))
      true
    )

    (ok (map-set song-versions
      { song-id: song-id, version-id: version-id }
      {
        version-type: version-type,
        parent-song-id: parent-song-id,
        added-date: block-height
      }
    ))
  )
)

;; Helper function to get total rights percentage for a song and rights type
(define-read-only (get-total-rights-percentage (song-id (string-ascii 36)) (rights-type (string-ascii 20)))
  ;; In a real implementation, this would iterate through all rights holders
  ;; For simplicity, we're just returning a placeholder value
  u0
)

;; Get song details
(define-read-only (get-song (song-id (string-ascii 36)))
  (map-get? songs { song-id: song-id })
)

;; Get rights holder details
(define-read-only (get-rights-holder (song-id (string-ascii 36)) (rights-holder principal))
  (map-get? rights-splits { song-id: song-id, rights-holder: rights-holder })
)

;; Get song version details
(define-read-only (get-song-version (song-id (string-ascii 36)) (version-id (string-ascii 36)))
  (map-get? song-versions { song-id: song-id, version-id: version-id })
)

;; Get song count by artist
(define-read-only (get-song-count-by-artist (artist (string-ascii 100)))
  (default-to { count: u0 } (map-get? song-count-by-artist { artist: artist }))
)

;; Check if a song is active
(define-read-only (is-song-active (song-id (string-ascii 36)))
  (let (
    (song (unwrap-panic (map-get? songs { song-id: song-id })))
  )
    (is-eq (get status song) "active")
  )
)

