import os
import requests


class NotionClient:
    """Server-owned integration; authorize resources before exposing through routes."""

    def retrieve_page(self, page_id: str):
        from uuid import UUID
        page_id = str(UUID(page_id))
        response = requests.get(f"https://api.notion.com/v1/pages/{page_id}", headers={
            "Authorization": f"Bearer {os.environ['NOTION_TOKEN']}",
            "Notion-Version": os.getenv("NOTION_VERSION", "2025-09-03"),
        }, timeout=10)
        response.raise_for_status()
        return response.json()
