"""Esquema inicial PostgreSQL 15 + TimescaleDB (Telema Mobility).

Incluye tablas del prompt, hypertables, compresión y vistas v_fleet_health / v_active_ga_jobs.
`maintenance_tickets` se crea sin `anomaly_event_id`; luego se añade UUID sin FK (hypertable
`anomaly_events` tiene PK `(time, id)`; Timescale no permite FK solo a `id`). `ticket_id` en
`anomaly_events` mantiene el vínculo opuesto hacia tickets.

Revision ID: 20260327_0001
Revises:
Create Date: 2026-03-27

"""

from __future__ import annotations

import os

from alembic import op
from sqlalchemy import text

revision = "20260327_0001"
down_revision = None
branch_labels = None
depends_on = None


def _use_timescaledb() -> bool:
    """TimescaleDB viene en la imagen Docker del repo; Postgres «vanilla» en Windows no."""
    v = os.environ.get("TELEMA_USE_TIMESCALEDB", "true").strip().lower()
    return v in ("1", "true", "yes", "on")


def upgrade() -> None:
    if _use_timescaledb():
        op.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb;"))

    op.execute(
        text("""
        CREATE TABLE clients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(200) NOT NULL,
            nit VARCHAR(30) UNIQUE,
            contact_email VARCHAR(150),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE fleets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(150) NOT NULL,
            client_id UUID REFERENCES clients(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(200) UNIQUE NOT NULL,
            full_name VARCHAR(200),
            role VARCHAR(50) CHECK (role IN ('admin', 'fleet_manager', 'technician', 'viewer')),
            client_id UUID REFERENCES clients(id),
            hashed_password TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE vehicles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plate VARCHAR(20) UNIQUE NOT NULL,
            vin VARCHAR(50) UNIQUE,
            model VARCHAR(100),
            brand VARCHAR(100),
            year INTEGER,
            fleet_id UUID REFERENCES fleets(id),
            firmware_version VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE ga_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            fleet_id UUID REFERENCES fleets(id),
            status VARCHAR(30) DEFAULT 'running',
            generations_completed INTEGER DEFAULT 0,
            best_fitness FLOAT,
            best_chromosome JSONB,
            config JSONB,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE digital_twins (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vehicle_id UUID UNIQUE NOT NULL REFERENCES vehicles(id),
            engine_health FLOAT CHECK (engine_health BETWEEN 0 AND 1),
            battery_health FLOAT CHECK (battery_health BETWEEN 0 AND 1),
            tire_health_avg FLOAT CHECK (tire_health_avg BETWEEN 0 AND 1),
            transmission_health FLOAT CHECK (transmission_health BETWEEN 0 AND 1),
            overall_health FLOAT CHECK (overall_health BETWEEN 0 AND 1),
            divergence_score FLOAT DEFAULT 0.0,
            failure_probability FLOAT DEFAULT 0.0,
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            twin_state JSONB
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE ml_models (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            version VARCHAR(50) NOT NULL,
            algorithm VARCHAR(100),
            f1_score FLOAT,
            precision_score FLOAT,
            recall_score FLOAT,
            is_active BOOLEAN DEFAULT FALSE,
            mlflow_run_id VARCHAR(100),
            artifact_path TEXT,
            trained_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(name, version)
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE maintenance_tickets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vehicle_id UUID NOT NULL REFERENCES vehicles(id),
            status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
            priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            assigned_to UUID REFERENCES users(id),
            scheduled_date TIMESTAMPTZ,
            resolved_date TIMESTAMPTZ,
            estimated_cost NUMERIC(12,2),
            actual_cost NUMERIC(12,2),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE anomaly_events (
            time TIMESTAMPTZ NOT NULL,
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            vehicle_id UUID NOT NULL REFERENCES vehicles(id),
            anomaly_score FLOAT NOT NULL,
            severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
            sensor_affected VARCHAR(100),
            model_version VARCHAR(50),
            description TEXT,
            ticket_id UUID REFERENCES maintenance_tickets(id),
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (time, id)
        );
        """)
    )
    # Sin FK a anomaly_events: hypertable exige PK que incluya `time`; no se puede REFERENCE solo id.
    op.execute(
        text("""
        ALTER TABLE maintenance_tickets
        ADD COLUMN anomaly_event_id UUID;
        """)
    )
    op.execute(
        text("""
        CREATE TABLE telemetry_readings (
            time TIMESTAMPTZ NOT NULL,
            device_time TIMESTAMPTZ NOT NULL,
            vehicle_id UUID NOT NULL REFERENCES vehicles(id),
            speed FLOAT,
            engine_temp FLOAT,
            battery_voltage FLOAT,
            rpm INTEGER,
            tire_pressure_fl FLOAT,
            tire_pressure_fr FLOAT,
            tire_pressure_rl FLOAT,
            tire_pressure_rr FLOAT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            altitude FLOAT,
            odometer FLOAT,
            kafka_offset BIGINT,
            flink_job_id UUID,
            is_anomaly_candidate BOOLEAN DEFAULT FALSE,
            raw_payload JSONB
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE digital_twin_snapshots (
            time TIMESTAMPTZ NOT NULL,
            vehicle_id UUID NOT NULL REFERENCES vehicles(id),
            engine_health FLOAT,
            battery_health FLOAT,
            tire_health_avg FLOAT,
            overall_health FLOAT,
            divergence_score FLOAT,
            failure_probability FLOAT,
            snapshot_data JSONB
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE pipeline_audit_log (
            time TIMESTAMPTZ NOT NULL,
            vehicle_id UUID,
            kafka_offset BIGINT,
            mqtt_received TIMESTAMPTZ,
            kafka_ingested TIMESTAMPTZ,
            scada_processed TIMESTAMPTZ,
            db_written TIMESTAMPTZ,
            total_latency_ms INTEGER,
            stage VARCHAR(50),
            status VARCHAR(20),
            error_detail TEXT
        );
        """)
    )
    op.execute(
        text("""
        CREATE TABLE maintenance_schedules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vehicle_id UUID NOT NULL REFERENCES vehicles(id),
            scheduled_date TIMESTAMPTZ NOT NULL,
            maintenance_type VARCHAR(100),
            estimated_duration_hours FLOAT,
            estimated_cost NUMERIC(12,2),
            ga_job_id UUID REFERENCES ga_jobs(id),
            chromosome_data JSONB,
            fitness_score FLOAT,
            status VARCHAR(30) DEFAULT 'planned',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)
    )

    if _use_timescaledb():
        op.execute(
            text(
                "SELECT create_hypertable('telemetry_readings', 'time', "
                "chunk_time_interval => INTERVAL '7 days');"
            )
        )
        op.execute(
            text(
                "SELECT create_hypertable('anomaly_events', 'time', "
                "chunk_time_interval => INTERVAL '7 days');"
            )
        )
        op.execute(
            text(
                "SELECT create_hypertable('digital_twin_snapshots', 'time', "
                "chunk_time_interval => INTERVAL '1 day');"
            )
        )
        op.execute(
            text(
                "SELECT create_hypertable('pipeline_audit_log', 'time', "
                "chunk_time_interval => INTERVAL '1 day');"
            )
        )

        op.execute(
            text("""
            ALTER TABLE telemetry_readings SET (
                timescaledb.compress,
                timescaledb.compress_segmentby = 'vehicle_id',
                timescaledb.compress_orderby = 'time DESC'
            );
            """)
        )
        op.execute(text("SELECT add_compression_policy('telemetry_readings', INTERVAL '30 days');"))

        op.execute(
            text("""
            ALTER TABLE digital_twin_snapshots SET (
                timescaledb.compress,
                timescaledb.compress_segmentby = 'vehicle_id',
                timescaledb.compress_orderby = 'time DESC'
            );
            """)
        )
        op.execute(text("SELECT add_compression_policy('digital_twin_snapshots', INTERVAL '30 days');"))

        op.execute(
            text("""
            ALTER TABLE pipeline_audit_log SET (
                timescaledb.compress,
                timescaledb.compress_orderby = 'time DESC'
            );
            """)
        )
        op.execute(text("SELECT add_compression_policy('pipeline_audit_log', INTERVAL '7 days');"))

    op.execute(
        text("""
        CREATE VIEW v_fleet_health AS
        SELECT
            v.id AS vehicle_id,
            v.plate,
            v.model,
            f.name AS fleet_name,
            dt.overall_health,
            dt.divergence_score,
            dt.failure_probability,
            dt.last_updated,
            COUNT(DISTINCT ae.id) FILTER (
                WHERE ae.severity IN ('high','critical') AND ae.resolved_at IS NULL
            ) AS open_critical_anomalies,
            COUNT(DISTINCT mt.id) FILTER (WHERE mt.status = 'open') AS open_tickets
        FROM vehicles v
        JOIN fleets f ON v.fleet_id = f.id
        LEFT JOIN digital_twins dt ON v.id = dt.vehicle_id
        LEFT JOIN anomaly_events ae ON v.id = ae.vehicle_id
        LEFT JOIN maintenance_tickets mt ON v.id = mt.vehicle_id
        GROUP BY v.id, v.plate, v.model, f.name,
            dt.overall_health, dt.divergence_score, dt.failure_probability, dt.last_updated;
        """)
    )
    op.execute(
        text("""
        CREATE VIEW v_active_ga_jobs AS
        SELECT * FROM ga_jobs WHERE status = 'running' ORDER BY started_at DESC;
        """)
    )


def downgrade() -> None:
    op.execute(text("DROP VIEW IF EXISTS v_active_ga_jobs;"))
    op.execute(text("DROP VIEW IF EXISTS v_fleet_health;"))

    op.execute(text("DROP TABLE IF EXISTS telemetry_readings CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS digital_twin_snapshots CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS pipeline_audit_log CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS maintenance_schedules CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS anomaly_events CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS maintenance_tickets CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS digital_twins CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS ml_models CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS ga_jobs CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS vehicles CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS fleets CASCADE;"))
    op.execute(text("DROP TABLE IF EXISTS clients CASCADE;"))
