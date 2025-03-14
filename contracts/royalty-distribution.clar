;; Royalty Distribution Contract
;; Automates payments to rights holders

;; Define data variables
(define-map royalty-payments
  {
    payment-id: (string-ascii 36)
  }
  {
    song-id: (string-ascii 36),
    platform-id: (string-ascii 36),
    reporting-period: (string-ascii 10),
    total-amount: uint,
    payment-date: uint,
    status: (string-ascii 20),  ;; pending, processing, completed, failed
    transaction-hash: (optional (buff 32))
  }
)

(define-map payment-distributions
  {
    payment-id: (string-ascii 36),
    rights-holder: principal
  }
  {
    amount: uint,
    percentage: uint,
    rights-type: (string-ascii 20),
    status: (string-ascii 20),  ;; pending, paid, failed
    distribution-date: (optional uint)
  }
)

(define-map payment-totals-by-holder
  { rights-holder: principal }
  {
    total-paid: uint,
    last-payment-date: (optional uint)
  }
)

(define-map admins principal bool)
(define-map payment-processors principal bool)

;; Define error codes
(define-constant ERR-NOT-AUTHORIZED u1)
(define-constant ERR-PAYMENT-EXISTS u2)
(define-constant ERR-PAYMENT-NOT-FOUND u3)
(define-constant ERR-DISTRIBUTION-EXISTS u4)
(define-constant ERR-DISTRIBUTION-NOT-FOUND u5)
(define-constant ERR-INVALID-PARAMETERS u6)
(define-constant ERR-NOT-PROCESSOR u7)
(define-constant ERR-PAYMENT-NOT-PENDING u8)
(define-constant ERR-DISTRIBUTION-NOT-PENDING u9)

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

;; Check if caller is a payment processor
(define-read-only (is-payment-processor)
  (or
    (is-admin)
    (default-to false (map-get? payment-processors tx-sender))
  )
)

;; Add a payment processor
(define-public (add-payment-processor (processor principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-set payment-processors processor true))
  )
)

;; Remove a payment processor
(define-public (remove-payment-processor (processor principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ok (map-delete payment-processors processor))
  )
)

;; Create a royalty payment
(define-public (create-royalty-payment
  (payment-id (string-ascii 36))
  (song-id (string-ascii 36))
  (platform-id (string-ascii 36))
  (reporting-period (string-ascii 10))
  (total-amount uint)
)
  (begin
    (asserts! (is-payment-processor) (err ERR-NOT-PROCESSOR))
    (asserts! (is-none (map-get? royalty-payments { payment-id: payment-id })) (err ERR-PAYMENT-EXISTS))

    ;; For simplicity, we assume all streaming data with valid IDs exists and is verified
    ;; In a production environment, this would check against the streaming tracking contract
    (let (
      (mock-data-exists true)
    )
      (asserts! mock-data-exists (err ERR-INVALID-PARAMETERS))

      (ok (map-set royalty-payments
        { payment-id: payment-id }
        {
          song-id: song-id,
          platform-id: platform-id,
          reporting-period: reporting-period,
          total-amount: total-amount,
          payment-date: block-height,
          status: "pending",
          transaction-hash: none
        }
      ))
    )
  )
)

;; Add a payment distribution
(define-public (add-payment-distribution
  (payment-id (string-ascii 36))
  (rights-holder principal)
  (amount uint)
  (percentage uint)
  (rights-type (string-ascii 20))
)
  (begin
    (asserts! (is-payment-processor) (err ERR-NOT-PROCESSOR))
    (asserts! (is-some (map-get? royalty-payments { payment-id: payment-id })) (err ERR-PAYMENT-NOT-FOUND))
    (asserts! (is-none (map-get? payment-distributions { payment-id: payment-id, rights-holder: rights-holder })) (err ERR-DISTRIBUTION-EXISTS))

    (let (
      (payment (unwrap-panic (map-get? royalty-payments { payment-id: payment-id })))
    )
      (asserts! (is-eq (get status payment) "pending") (err ERR-PAYMENT-NOT-PENDING))

      (ok (map-set payment-distributions
        { payment-id: payment-id, rights-holder: rights-holder }
        {
          amount: amount,
          percentage: percentage,
          rights-type: rights-type,
          status: "pending",
          distribution-date: none
        }
      ))
    )
  )
)

;; Process a royalty payment
(define-public (process-royalty-payment
  (payment-id (string-ascii 36))
  (transaction-hash (buff 32))
)
  (let (
    (payment (unwrap! (map-get? royalty-payments { payment-id: payment-id }) (err ERR-PAYMENT-NOT-FOUND)))
  )
    (asserts! (is-payment-processor) (err ERR-NOT-PROCESSOR))
    (asserts! (is-eq (get status payment) "pending") (err ERR-PAYMENT-NOT-PENDING))

    ;; In a real implementation, this would trigger actual payments
    ;; For simplicity, we're just updating the status

    (ok (map-set royalty-payments
      { payment-id: payment-id }
      (merge payment {
        status: "completed",
        transaction-hash: (some transaction-hash)
      })
    ))
  )
)

;; Process a distribution payment
(define-public (process-distribution
  (payment-id (string-ascii 36))
  (rights-holder principal)
)
  (let (
    (distribution (unwrap! (map-get? payment-distributions { payment-id: payment-id, rights-holder: rights-holder }) (err ERR-DISTRIBUTION-NOT-FOUND)))
    (holder-totals (default-to { total-paid: u0, last-payment-date: none } (map-get? payment-totals-by-holder { rights-holder: rights-holder })))
  )
    (asserts! (is-payment-processor) (err ERR-NOT-PROCESSOR))
    (asserts! (is-eq (get status distribution) "pending") (err ERR-DISTRIBUTION-NOT-PENDING))

    ;; Update holder totals
    (map-set payment-totals-by-holder
      { rights-holder: rights-holder }
      {
        total-paid: (+ (get total-paid holder-totals) (get amount distribution)),
        last-payment-date: (some block-height)
      }
    )

    ;; Update distribution status
    (ok (map-set payment-distributions
      { payment-id: payment-id, rights-holder: rights-holder }
      (merge distribution {
        status: "paid",
        distribution-date: (some block-height)
      })
    ))
  )
)

;; Get royalty payment details
(define-read-only (get-royalty-payment (payment-id (string-ascii 36)))
  (map-get? royalty-payments { payment-id: payment-id })
)

;; Get payment distribution details
(define-read-only (get-payment-distribution (payment-id (string-ascii 36)) (rights-holder principal))
  (map-get? payment-distributions { payment-id: payment-id, rights-holder: rights-holder })
)

;; Get payment totals for a rights holder
(define-read-only (get-payment-totals (rights-holder principal))
  (default-to { total-paid: u0, last-payment-date: none } (map-get? payment-totals-by-holder { rights-holder: rights-holder }))
)

;; Calculate royalty distribution for a song
(define-read-only (calculate-royalty-distribution (song-id (string-ascii 36)) (total-amount uint))
  ;; In a real implementation, this would calculate the distribution based on rights splits
  ;; For simplicity, we're just returning a placeholder
  none
)

;; Check if principal is a processor
(define-read-only (check-is-processor (principal principal))
  (or
    (is-admin)
    (default-to false (map-get? payment-processors principal))
  )
)

