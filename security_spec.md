# Security Specification & Payload-First TDD — Aethervale: Brass Highlands

## 1. Data Invariants

1. **Identity Ownership**: A `UserProfile` at `/users/{userId}` can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Parent Anchor (Master Gate)**: A `SaveSlot` at `/users/{userId}/saves/{slotId}` cannot be created or updated unless the parent `/users/{userId}` document exists and belongs to `request.auth.uid`.
3. **Slot Confinement**: `slotId` must strictly belong to `['autosave', 'slot_1', 'slot_2', 'slot_3']` and match `data.slotId`.
4. **Immutable Lineage & Server Timestamps**: `uid`, `ownerId`, `slotId`, and `createdAt` are immutable after creation. `createdAt == request.time` on create; `updatedAt == request.time` on both create and update.
5. **Volumetric & Schema Caps**: All strings enforce explicit `maxLength` matching `firebase-blueprint.json`; all arrays enforce bounded `.size()` caps (`companions <= 4`, `inventory <= 80`, `quests <= 30`, `customSkills <= 8`) with element type guards.
6. **Zero PII Exposure**: No email, phone, or address is stored in Firestore documents; reads and list queries are strictly owner-scoped (`resource.data.ownerId == request.auth.uid`).

## 2. The Dirty Dozen Malicious Payloads (All Must Return PERMISSION_DENIED)

1. **Unauthenticated Read**: `GET /users/alice/saves/slot_1` with `auth == null`.
2. **Cross-User Read**: User `bob` requests `GET /users/alice/saves/slot_1`.
3. **Cross-User List Scraping**: User `bob` lists `/users/alice/saves` or queries without matching `ownerId == request.auth.uid`.
4. **Identity Spoofing on Create**: User `alice` creates `/users/alice/saves/slot_1` with `ownerId: "bob"`.
5. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to write `/users/alice`.
6. **Shadow Field Injection**: User `alice` updates `/users/alice/saves/slot_1` with an extra ghost field `isAdmin: true`.
7. **Path ID Poisoning**: User `alice` attempts to create `/users/alice/saves/slot_invalid_99999999999999999999999999`.
8. **Orphaned Save Write (Master Gate Bypass)**: User `alice` creates `/users/alice/saves/slot_1` when `/users/alice` does not exist.
9. **Client Timestamp Forgery**: User `alice` creates a save with `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()`.
10. **Immutable Field Mutation**: User `alice` updates `/users/alice/saves/slot_1` attempting to alter `createdAt` or `ownerId`.
11. **Value Poisoning / Size Exhaustion**: User `alice` updates `heroName` with a 500-character string or `heroLevel: 9999`.
12. **Array Overflow Attack**: User `alice` submits `inventory` with 150 items (exceeding cap of 80) or `companions` with 10 entries (exceeding cap of 4).
