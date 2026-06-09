import {
  type Channel,
  ChannelCredentials,
  createChannel,
  createClientFactory,
} from "nice-grpc";
import type { EventServiceClient } from "../generated/whatsapp_event_service.ts";
import { EventServiceDefinition } from "../generated/whatsapp_event_service.ts";
import type { MessageServiceClient } from "../generated/whatsapp_message_service.ts";
import { MessageServiceDefinition } from "../generated/whatsapp_message_service.ts";
import type { PollServiceClient } from "../generated/whatsapp_poll_service.ts";
import { PollServiceDefinition } from "../generated/whatsapp_poll_service.ts";
import type { RetryOptions } from "../types/common.ts";
import {
  authMiddleware,
  retryMiddleware,
  timeoutMiddleware,
  trailingMetadataCaptureMiddleware,
} from "./metadata.ts";

export type { EventServiceClient } from "../generated/whatsapp_event_service.ts";
export type { MessageServiceClient } from "../generated/whatsapp_message_service.ts";
export type { PollServiceClient } from "../generated/whatsapp_poll_service.ts";

export interface GrpcClients {
  readonly channel: Channel;
  readonly events: EventServiceClient;
  readonly messages: MessageServiceClient;
  readonly polls: PollServiceClient;
}

export interface GrpcClientOptions {
  readonly address: string;
  readonly retry?: boolean | RetryOptions;
  readonly timeout?: number;
  readonly tls?: boolean;
  readonly token?: string | (() => Promise<string>);
}

export function createGrpcClients(options: GrpcClientOptions): GrpcClients {
  const credentials =
    (options.tls ?? true)
      ? ChannelCredentials.createSsl()
      : ChannelCredentials.createInsecure();

  const channel = createChannel(options.address, credentials);
  let factory = createClientFactory();

  if (options.retry) {
    factory = factory.use(
      retryMiddleware(options.retry === true ? {} : options.retry)
    );
  }

  if (options.timeout) {
    factory = factory.use(timeoutMiddleware(options.timeout));
  }

  if (options.token) {
    factory = factory.use(authMiddleware(options.token));
  }

  factory = factory.use(trailingMetadataCaptureMiddleware());

  return {
    messages: factory.create(MessageServiceDefinition, channel),
    polls: factory.create(PollServiceDefinition, channel),
    events: factory.create(EventServiceDefinition, channel),
    channel,
  };
}
