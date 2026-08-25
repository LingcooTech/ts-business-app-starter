CREATE TABLE "payment_callbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"event_id" varchar(160) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"body_sha256" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"payment_intent_id" uuid,
	"payment_refund_id" uuid,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_callbacks_provider_check" CHECK ("payment_callbacks"."provider" in ('alipay', 'wechat')),
	CONSTRAINT "payment_callbacks_status_check" CHECK ("payment_callbacks"."status" in ('received', 'processed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"merchant_order_id" varchar(64) NOT NULL,
	"provider_transaction_id" varchar(128),
	"subject" varchar(120) NOT NULL,
	"description" varchar(500),
	"amount_minor" bigint NOT NULL,
	"refunded_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'CNY' NOT NULL,
	"status" varchar(30) DEFAULT 'created' NOT NULL,
	"checkout_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"last_error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_provider_check" CHECK ("payment_intents"."provider" in ('mock', 'alipay', 'wechat')),
	CONSTRAINT "payment_intents_status_check" CHECK ("payment_intents"."status" in ('created', 'pending', 'succeeded', 'closed', 'failed', 'partially_refunded', 'refunded')),
	CONSTRAINT "payment_intents_currency_check" CHECK ("payment_intents"."currency" = 'CNY'),
	CONSTRAINT "payment_intents_amount_check" CHECK ("payment_intents"."amount_minor" > 0),
	CONSTRAINT "payment_intents_refunded_amount_check" CHECK ("payment_intents"."refunded_amount_minor" >= 0 and "payment_intents"."refunded_amount_minor" <= "payment_intents"."amount_minor")
);
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"merchant_refund_id" varchar(64) NOT NULL,
	"provider_refund_id" varchar(128),
	"amount_minor" bigint NOT NULL,
	"reason" varchar(300),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"refunded_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refunds_status_check" CHECK ("payment_refunds"."status" in ('pending', 'succeeded', 'failed')),
	CONSTRAINT "payment_refunds_amount_check" CHECK ("payment_refunds"."amount_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_type_check";--> statement-breakpoint
ALTER TABLE "payment_callbacks" ADD CONSTRAINT "payment_callbacks_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_callbacks" ADD CONSTRAINT "payment_callbacks_payment_refund_id_payment_refunds_id_fk" FOREIGN KEY ("payment_refund_id") REFERENCES "public"."payment_refunds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_created_by_identity_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."identity_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_callbacks_provider_event_unique" ON "payment_callbacks" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "payment_callbacks_status_created_idx" ON "payment_callbacks" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_merchant_order_unique" ON "payment_intents" USING btree ("merchant_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_provider_transaction_unique" ON "payment_intents" USING btree ("provider","provider_transaction_id") WHERE "payment_intents"."provider_transaction_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_intents_status_created_idx" ON "payment_intents" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_merchant_refund_unique" ON "payment_refunds" USING btree ("merchant_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_provider_refund_unique" ON "payment_refunds" USING btree ("provider_refund_id") WHERE "payment_refunds"."provider_refund_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_refunds_intent_created_idx" ON "payment_refunds" USING btree ("payment_intent_id","created_at");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_type_check" CHECK ("audit_logs"."actor_type" in ('user', 'system', 'job', 'provider'));