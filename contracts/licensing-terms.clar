;; Licensing Terms Contract
;; Defines usage rights for different platforms

;; Define data variables
(define-map license-templates
  { template-id: uint }
  {
    name: (string-ascii 50),
    description: (string-ascii 200),
    license-type: (string-ascii 20),  ;; streaming, sync, mechanical, etc.
    duration-days: uint,
    territory: (string-ascii 50),     ;; global, US, EU, etc.
    exclusive: bool,
    created-by: principal,
    creation-date: uint,
    active: bool
  }
)

(define-map platform-rates
  {
    template-id: uint,
    platform-id: (string-ascii 36)
  }
  {
    platform-name: (string-ascii 50),
    rate-per-use: uint,  ;; Rate in cents per use (stream, download, etc.)
    minimum-fee: uint,   ;; Minimum fee in cents
    added-date: uint
  }
)

(define-map song-licenses
  {
    song-id: (string-ascii 36),
    license-id: (string-ascii 36)
  }
  {
    licensee: principal,
    template-id: uint,
    start-date: uint,
    end-date: uint,
    custom-terms: (optional (string-ascii 500)),
    status: (string-ascii 20),  ;; active, expired, terminated
    created-date: uint
  }
)

(define-map admins principal bool)
(define-map license-managers principal bool)

;; Define error codes
(define-constant ERR-NOT-AUTHORIZED u1)
(define-constant ERR-TEMPLATE-EXISTS u2)
(define-constant ERR-TEMPLATE-NOT-FOUND u3)
(define-constant ERR-PLATFORM-EXISTS u4)
(define-constant ERR-PLATFORM-NOT-FOUND u5)
(define-constant ERR-LICENSE-EXISTS u6)
(define-constant ERR-LICENSE-NOT-FOUND u7)
(define-constant ERR-INVALID-PARAMETERS u8)
(define-constant ERR-SONG-NOT-ACTIVE u9)

;; Initialize contract with contract deployer as admin
(define-data-var contract-owner principal tx-sender)
(define-data-var next-template-id uint u1)

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

;; Check if caller is a license manager
(define-read-only (is-license-manager)
  (or
    (is-admin)
    (default-to false (map-get? license-managers tx-sender))
  )
)

;; Add a license manager
(define-public (add-license-manager (manager principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-set license-managers manager true))
  )
)

;; Remove a license manager
(define-public (remove-license-manager (manager principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-delete license-managers manager))
  )
)

;; Create a new license template
(define-public (create-license-template
  (name (string-ascii 50))
  (description (string-ascii 200))
  (license-type (string-ascii 20))
  (duration-days uint)
  (territory (string-ascii 50))
  (exclusive bool)
)
  (let (
    (template-id (var-get next-template-id))
  )
    (asserts! (is-license-manager) (err ERR-NOT-AUTHORIZED))

    (var-set next-template-id (+ template-id u1))

    (ok (map-set license-templates
      { template-id: template-id }
      {
        name: name,
        description: description,
        license-type: license-type,
        duration-days: duration-days,
        territory: territory,
        exclusive: exclusive,
        created-by: tx-sender,
        creation-date: block-height,
        active: true
      }
    ))
  )
)

;; Update a license template
(define-public (update-license-template
  (template-id uint)
  (name (string-ascii 50))
  (description (string-ascii 200))
  (license-type (string-ascii 20))
  (duration-days uint)
  (territory (string-ascii 50))
  (exclusive bool)
  (active bool)
)
  (let (
    (template (unwrap! (map-get? license-templates { template-id: template-id }) (err ERR-TEMPLATE-NOT-FOUND)))
  )
    (asserts! (is-license-manager) (err ERR-NOT-AUTHORIZED))

    (ok (map-set license-templates
      { template-id: template-id }
      {
        name: name,
        description: description,
        license-type: license-type,
        duration-days: duration-days,
        territory: territory,
        exclusive: exclusive,
        created-by: (get created-by template),
        creation-date: (get creation-date template),
        active: active
      }
    ))
  )
)

;; Add platform rate for a license template
(define-public (add-platform-rate
  (template-id uint)
  (platform-id (string-ascii 36))
  (platform-name (string-ascii 50))
  (rate-per-use uint)
  (minimum-fee uint)
)
  (begin
    (asserts! (is-license-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (map-get? license-templates { template-id: template-id })) (err ERR-TEMPLATE-NOT-FOUND))
    (asserts! (is-none (map-get? platform-rates { template-id: template-id, platform-id: platform-id })) (err ERR-PLATFORM-EXISTS))

    (ok (map-set platform-rates
      { template-id: template-id, platform-id: platform-id }
      {
        platform-name: platform-name,
        rate-per-use: rate-per-use,
        minimum-fee: minimum-fee,
        added-date: block-height
      }
    ))
  )
)

;; Update platform rate
(define-public (update-platform-rate
  (template-id uint)
  (platform-id (string-ascii 36))
  (platform-name (string-ascii 50))
  (rate-per-use uint)
  (minimum-fee uint)
)
  (begin
    (asserts! (is-license-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (map-get? platform-rates { template-id: template-id, platform-id: platform-id })) (err ERR-PLATFORM-NOT-FOUND))

    (ok (map-set platform-rates
      { template-id: template-id, platform-id: platform-id }
      {
        platform-name: platform-name,
        rate-per-use: rate-per-use,
        minimum-fee: minimum-fee,
        added-date: block-height
      }
    ))
  )
)

;; Create a license for a song
(define-public (create-song-license
  (song-id (string-ascii 36))
  (license-id (string-ascii 36))
  (licensee principal)
  (template-id uint)
  (start-date uint)
  (end-date uint)
  (custom-terms (optional (string-ascii 500)))
)
  (begin
    (asserts! (is-license-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (map-get? license-templates { template-id: template-id })) (err ERR-TEMPLATE-NOT-FOUND))
    (asserts! (is-none (map-get? song-licenses { song-id: song-id, license-id: license-id })) (err ERR-LICENSE-EXISTS))
    (asserts! (< start-date end-date) (err ERR-INVALID-PARAMETERS))

    ;; For simplicity, we assume all songs with valid IDs are active
    ;; In a production environment, this would check against the song registration contract

    (ok (map-set song-licenses
      { song-id: song-id, license-id: license-id }
      {
        licensee: licensee,
        template-id: template-id,
        start-date: start-date,
        end-date: end-date,
        custom-terms: custom-terms,
        status: "active",
        created-date: block-height
      }
    ))
  )
)

;; Update license status
(define-public (update-license-status
  (song-id (string-ascii 36))
  (license-id (string-ascii 36))
  (status (string-ascii 20))
)
  (let (
    (license (unwrap! (map-get? song-licenses { song-id: song-id, license-id: license-id }) (err ERR-LICENSE-NOT-FOUND)))
  )
    (asserts! (is-license-manager) (err ERR-NOT-AUTHORIZED))

    (ok (map-set song-licenses
      { song-id: song-id, license-id: license-id }
      (merge license { status: status })
    ))
  )
)

;; Get license template details
(define-read-only (get-license-template (template-id uint))
  (map-get? license-templates { template-id: template-id })
)

;; Get platform rate details
(define-read-only (get-platform-rate (template-id uint) (platform-id (string-ascii 36)))
  (map-get? platform-rates { template-id: template-id, platform-id: platform-id })
)

;; Get song license details
(define-read-only (get-song-license (song-id (string-ascii 36)) (license-id (string-ascii 36)))
  (map-get? song-licenses { song-id: song-id, license-id: license-id })
)

;; Check if a license is active
(define-read-only (is-license-active (song-id (string-ascii 36)) (license-id (string-ascii 36)))
  (let (
    (license (unwrap-panic (map-get? song-licenses { song-id: song-id, license-id: license-id })))
  )
    (and
      (is-eq (get status license) "active")
      (>= block-height (get start-date license))
      (<= block-height (get end-date license))
    )
  )
)

;; Get rate for a song on a specific platform
(define-read-only (get-song-platform-rate (song-id (string-ascii 36)) (platform-id (string-ascii 36)))
  (let (
    (active-licenses (get-active-licenses-for-song song-id))
  )
    ;; In a real implementation, this would find the appropriate license and return the rate
    ;; For simplicity, we're just returning a placeholder value
    u0
  )
)

;; Helper function to get active licenses for a song
(define-read-only (get-active-licenses-for-song (song-id (string-ascii 36)))
  ;; In a real implementation, this would iterate through all licenses
  ;; For simplicity, we're just returning a placeholder
  none
)

