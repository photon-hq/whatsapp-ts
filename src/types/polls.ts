import type { WriteOptions } from "./common.ts";

export interface PollChoice {
  /** Zero-based choice index used by `polls.vote(...)`. */
  readonly index: number;
  readonly text: string;
  /** Current vote count visible on this device/account. */
  readonly voteCount: number;
}

export interface Poll {
  readonly allowMultipleChoices: boolean;
  /** Current choices and vote counts. */
  readonly choices: readonly PollChoice[];
  readonly hideVoterNames: boolean;
  /** Local WhatsApp message unique key for this device/account. */
  readonly pollId: string;
  readonly question: string;
}

export interface CreatePollSettings extends WriteOptions {
  /** Allow voters to select more than one choice. Defaults to `false`. */
  readonly allowMultipleChoices?: boolean;
  /** Optional close time. Must be in the future. */
  readonly closesAt?: Date;
  /** Ask WhatsApp to hide voter names when supported. Defaults to `false`. */
  readonly hideVoterNames?: boolean;
}

export type PollWriteOptions = WriteOptions;
