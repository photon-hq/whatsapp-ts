import { toWhatsAppError } from "../errors/to-whatsapp-error.ts";
import { validationError } from "../errors/validation-error.ts";
import type { ProfileServiceClient } from "../transport/grpc-client.ts";
import type {
  ModifyProfileOptions,
  ProfileUpdateResult,
} from "../types/profile.ts";

export class ProfileResource {
  private readonly _client: ProfileServiceClient;

  constructor(client: ProfileServiceClient) {
    this._client = client;
  }

  async modify(options: ModifyProfileOptions): Promise<ProfileUpdateResult> {
    try {
      const name = options.name?.trim();
      if (name !== undefined && name.length === 0) {
        throw validationError("name must not be empty", { field: "name" });
      }

      const about = options.about;
      if (about !== undefined && typeof about !== "string") {
        throw validationError("about must be a string", { field: "about" });
      }

      const avatar =
        options.avatar === undefined
          ? undefined
          : parseBytes(options.avatar, "avatar");

      if (name === undefined && about === undefined && avatar === undefined) {
        throw validationError(
          "at least one of name, about, or avatar is required",
          { field: "name" }
        );
      }

      const response = await this._client.modifyProfile({
        name,
        about,
        avatar,
      });

      return {
        nameUpdated: response.nameUpdated,
        aboutUpdated: response.aboutUpdated,
        avatarUpdated: response.avatarUpdated,
      };
    } catch (err) {
      throw toWhatsAppError(err);
    }
  }
}

function parseBytes(value: Uint8Array, field: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength === 0) {
    throw validationError(`${field} must be non-empty binary data`, { field });
  }

  return value;
}
