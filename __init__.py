"""The Calendar Column View integration."""
import logging
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Calendar Column View component."""
    _LOGGER.warning("Setting up Calendar Column View integration")

    # Check if our integration is in the config
    if DOMAIN not in config:
        _LOGGER.warning(f"{DOMAIN} not found in configuration, skipping setup")
        return True

    # Register the static path for the JavaScript file
    card_path = Path(__file__).parent / "www"
    _LOGGER.warning(f"Registering static path: /hacsfiles/{DOMAIN} -> {card_path}")

    try:
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                url_path=f"/hacsfiles/{DOMAIN}",
                path=str(card_path),
                cache_headers=True,
            )
        ])
        _LOGGER.warning("Calendar Column View static path registered successfully")
    except Exception as e:
        _LOGGER.error(f"Failed to register static path: {e}")
        return False

    _LOGGER.warning("Calendar Column View integration setup complete")
    return True
