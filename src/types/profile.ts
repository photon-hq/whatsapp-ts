/** Fields to update on the current WhatsApp account profile. */
export interface ModifyProfileOptions {
  /** New about/status text. Empty string clears it when WhatsApp allows. */
  readonly about?: string;
  /** New avatar image bytes (JPEG or PNG). */
  readonly avatar?: Uint8Array;
  /** New push name. Must be non-empty after trimming. */
  readonly name?: string;
}

/** Reports which profile fields were requested and successfully applied. */
export interface ProfileUpdateResult {
  readonly aboutUpdated: boolean;
  readonly avatarUpdated: boolean;
  readonly nameUpdated: boolean;
}
