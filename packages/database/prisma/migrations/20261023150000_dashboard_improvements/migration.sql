ALTER TABLE marstek_measurements
  ADD COLUMN battery_details_at TIMESTAMPTZ,
  ALTER COLUMN charge_power_w DROP NOT NULL, ALTER COLUMN charge_power_w DROP DEFAULT,
  ALTER COLUMN discharge_power_w DROP NOT NULL, ALTER COLUMN discharge_power_w DROP DEFAULT,
  ALTER COLUMN charge_energy_wh DROP NOT NULL, ALTER COLUMN charge_energy_wh DROP DEFAULT,
  ALTER COLUMN discharge_energy_wh DROP NOT NULL, ALTER COLUMN discharge_energy_wh DROP DEFAULT;
-- Historical unavailable samples were previously stored as directional zeroes.
UPDATE marstek_measurements SET charge_power_w = NULL, discharge_power_w = NULL,
  charge_energy_wh = NULL, discharge_energy_wh = NULL WHERE power_source = 'unavailable';
ALTER TABLE notification_channels ADD COLUMN "eventTypes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "deviceIds" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "quietFrom" VARCHAR(5) NOT NULL DEFAULT '',
  ADD COLUMN "quietTo" VARCHAR(5) NOT NULL DEFAULT '', ADD COLUMN digest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE freelancehunt_project_states ADD COLUMN workflow VARCHAR(16) NOT NULL DEFAULT 'none'
  CHECK (workflow IN ('none','todo','applied','discussion','done'));
CREATE TABLE marstek_minutes (
  "deviceId" VARCHAR(64) NOT NULL, "bucketAt" TIMESTAMPTZ NOT NULL,
  samples INTEGER NOT NULL, "firstAt" TIMESTAMPTZ NOT NULL, "lastAt" TIMESTAMPTZ NOT NULL,
  "socSum" DOUBLE PRECISION NOT NULL, "socCount" INTEGER NOT NULL,
  "chargeSum" DOUBLE PRECISION NOT NULL, "chargeCount" INTEGER NOT NULL,
  "dischargeSum" DOUBLE PRECISION NOT NULL, "dischargeCount" INTEGER NOT NULL,
  "gridSum" DOUBLE PRECISION NOT NULL, "gridCount" INTEGER NOT NULL,
  "pvSum" DOUBLE PRECISION NOT NULL, "pvCount" INTEGER NOT NULL,
  "temperatureSum" DOUBLE PRECISION NOT NULL, "temperatureCount" INTEGER NOT NULL,
  "temperatureMin" DOUBLE PRECISION, "temperatureMax" DOUBLE PRECISION,
  "chargePeak" DOUBLE PRECISION, "dischargePeak" DOUBLE PRECISION,
  "chargeEnergyWh" DOUBLE PRECISION NOT NULL, "dischargeEnergyWh" DOUBLE PRECISION NOT NULL,
  "energyCount" INTEGER NOT NULL, "coverageSeconds" DOUBLE PRECISION NOT NULL,
  PRIMARY KEY ("deviceId", "bucketAt")
);
CREATE INDEX marstek_minutes_bucket_idx ON marstek_minutes ("bucketAt");
-- Existing history is backfilled by bounded worker batches, not a blocking migration.
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL,
  url VARCHAR(2048) NOT NULL, description VARCHAR(300) NOT NULL DEFAULT '',
  "group" VARCHAR(100) NOT NULL DEFAULT 'Сервіси', position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sites_group_position_idx ON sites ("group", position);
INSERT INTO sites (name,url,description,position) VALUES
 ('Timeflow API','https://api.timeflow.club/','API сервісу Timeflow',0),
 ('Timeflow','https://app.timeflow.club/','Застосунок Timeflow',1),
 ('Portainer','https://portainer.gorob.space/','Керування контейнерами',2),
 ('Torrent','https://torrent.gorob.space/','Торент-завантаження',3),
 ('Plex','https://plex.gorob.space/','Медіатека та перегляд відео',4),
 ('pgAdmin','https://pgadmin.gorob.space/','Керування PostgreSQL',5),
 ('Redis','https://redis.gorob.space/','Керування Redis',6);
