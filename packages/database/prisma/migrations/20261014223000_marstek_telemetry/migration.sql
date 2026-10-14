CREATE TABLE "marstek_devices" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "port" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marstek_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marstek_measurements" (
    "id" BIGSERIAL NOT NULL,
    "device_id" VARCHAR(64) NOT NULL,
    "sampled_at" TIMESTAMPTZ(6) NOT NULL,
    "soc_percent" DOUBLE PRECISION,
    "battery_power_w" DOUBLE PRECISION,
    "power_source" VARCHAR(16) NOT NULL,
    "charge_power_w" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discharge_power_w" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "charge_energy_wh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discharge_energy_wh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flow" VARCHAR(16) NOT NULL,
    "grid_power_w" DOUBLE PRECISION,
    "offgrid_power_w" DOUBLE PRECISION,
    "pv_power_w" DOUBLE PRECISION,
    "battery_temperature_c" DOUBLE PRECISION,
    "remaining_capacity_wh" DOUBLE PRECISION,
    "rated_capacity_wh" DOUBLE PRECISION,
    "grid_input_total_wh" DOUBLE PRECISION,
    "grid_output_total_wh" DOUBLE PRECISION,
    "pv_total_wh" DOUBLE PRECISION,
    "load_total_wh" DOUBLE PRECISION,
    "charge_allowed" BOOLEAN,
    "discharge_allowed" BOOLEAN,
    "mode" VARCHAR(32),
    "ct_connected" BOOLEAN,
    "meter_power_w" DOUBLE PRECISION,
    CONSTRAINT "marstek_measurements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marstek_measurements_device_id_sampled_at_idx" ON "marstek_measurements"("device_id", "sampled_at" DESC);
CREATE INDEX "marstek_measurements_sampled_at_idx" ON "marstek_measurements"("sampled_at");

ALTER TABLE "marstek_measurements" ADD CONSTRAINT "marstek_measurements_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "marstek_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
