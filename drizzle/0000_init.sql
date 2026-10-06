CREATE TYPE "public"."agent_status" AS ENUM('pending', 'verified', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."closed_reason" AS ENUM('meridian', 'elsewhere', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."lead_channel" AS ENUM('whatsapp', 'callback');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'viewing', 'closed');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending', 'active', 'expired', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('rent', 'sale', 'shortlet');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'self-contain', 'duplex', 'detached-house', 'terrace', 'bungalow', 'land', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('taken', 'fake', 'wrong-price', 'wrong-location', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('buyer', 'agent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."title_document" AS ENUM('c-of-o', 'governors-consent', 'deed-of-assignment', 'registered-survey', 'excision', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"agency_name" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text NOT NULL,
	"bio" text,
	"photo_url" text,
	"id_document_url" text,
	"cac_number" text,
	"status" "agent_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"decided_at" timestamp with time zone,
	"approved_listing_count" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"centre" geometry(point) NOT NULL,
	"default_zoom" integer DEFAULT 14 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "favourites" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text,
	"name" text,
	"phone" text,
	"message" text,
	"channel" "lead_channel" NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_rent_terms" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"agency_fee" bigint DEFAULT 0 NOT NULL,
	"legal_fee" bigint DEFAULT 0 NOT NULL,
	"caution_deposit" bigint DEFAULT 0 NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"total_upfront" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_sale_terms" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"title_document" "title_document" DEFAULT 'c-of-o' NOT NULL,
	"negotiable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_shortlet_terms" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"min_nights" integer DEFAULT 1 NOT NULL,
	"cleaning_fee" bigint DEFAULT 0 NOT NULL,
	"caution_deposit" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"area_id" integer,
	"slug" text NOT NULL,
	"type" "listing_type" DEFAULT 'rent' NOT NULL,
	"property_type" "property_type" DEFAULT 'apartment' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"location" geometry(point),
	"public_location" geometry(point),
	"street_name" text,
	"show_street" boolean DEFAULT false NOT NULL,
	"bedrooms" integer DEFAULT 0 NOT NULL,
	"bathrooms" integer DEFAULT 0 NOT NULL,
	"toilets" integer DEFAULT 0 NOT NULL,
	"parking" integer DEFAULT 0 NOT NULL,
	"size_sqm" integer,
	"furnished" boolean DEFAULT false NOT NULL,
	"serviced" boolean DEFAULT false NOT NULL,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"sandbox" boolean DEFAULT false NOT NULL,
	"draft_step" integer DEFAULT 1 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"hidden_by_reports" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"expiry_reminded_at" timestamp with time zone,
	"closed_reason" "closed_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"bounds" jsonb,
	"alerts_on" boolean DEFAULT true NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'buyer' NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_rent_terms" ADD CONSTRAINT "listing_rent_terms_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_sale_terms" ADD CONSTRAINT "listing_sale_terms_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_shortlet_terms" ADD CONSTRAINT "listing_shortlet_terms_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_profiles_slug_idx" ON "agent_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "agent_profiles_status_idx" ON "agent_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_agent_idx" ON "leads" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_listing_idx" ON "leads" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_images_listing_idx" ON "listing_images" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_rent_terms_total_idx" ON "listing_rent_terms" USING btree ("total_upfront");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_idx" ON "listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listings_public_location_gist" ON "listings" USING gist ("public_location");--> statement-breakpoint
CREATE INDEX "listings_location_gist" ON "listings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_type_idx" ON "listings" USING btree ("type");--> statement-breakpoint
CREATE INDEX "listings_area_idx" ON "listings" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX "listings_agent_idx" ON "listings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "reports_listing_idx" ON "reports" USING btree ("listing_id","resolved");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_token_idx" ON "saved_searches" USING btree ("unsubscribe_token");