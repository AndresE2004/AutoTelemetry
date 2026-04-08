"""Publicador async hacia Kafka (topic raw.telemetry) — misma forma que sensores reales."""

from __future__ import annotations

import json
import logging
from typing import Any

from aiokafka import AIOKafkaProducer

logger = logging.getLogger(__name__)


class TelemetryPublisher:
    def __init__(self, bootstrap_servers: str, topic: str = "raw.telemetry") -> None:
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self._producer: AIOKafkaProducer | None = None

    async def start(self) -> None:
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        )
        await self._producer.start()
        logger.info("Kafka producer started · %s · %s", self.bootstrap_servers, self.topic)

    async def stop(self) -> None:
        if self._producer:
            await self._producer.stop()
            self._producer = None

    async def publish(self, vehicle_id: str, payload: dict[str, Any], key: str | None = None) -> None:
        if not self._producer:
            raise RuntimeError("Producer not started")
        k = (key or vehicle_id).encode("utf-8")
        await self._producer.send_and_wait(self.topic, value=payload, key=k)
