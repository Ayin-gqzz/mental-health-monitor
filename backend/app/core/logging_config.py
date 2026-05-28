import logging
import sys
from datetime import datetime


class StructuredFormatter(logging.Formatter):
    def format(self, record):
        return f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | {record.levelname:8s} | {record.name:20s} | {record.getMessage()}"


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
