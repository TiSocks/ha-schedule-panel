"""The HA Schedule Panel integration."""
import os
import logging
import homeassistant.helpers.config_validation as cv
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import StaticPathConfig
from homeassistant.components import frontend

_LOGGER = logging.getLogger(__name__)

DOMAIN = "ha_schedule_panel"

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the component."""
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HA Schedule Panel from a config entry."""
    
    # Get the directory of this integration
    integration_dir = os.path.dirname(__file__)
    frontend_dir = os.path.join(integration_dir, "frontend")

    # Register the static path so HA can serve the JS file
    # We serve it at /ha_schedule_panel_static
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            f"/{DOMAIN}_static",
            frontend_dir,
            cache_headers=False
        )
    ])

    from homeassistant.loader import async_get_integration
    integration = await async_get_integration(hass, DOMAIN)
    version = integration.version

    # Register the custom panel
    _LOGGER.info("Registering HA Schedule Panel in sidebar with version %s", version)
    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Schedules",
        sidebar_icon="mdi:calendar-clock",
        frontend_url_path="schedules",
        require_admin=False,
        config={
            "_panel_custom": {
                "name": "schedule-panel",
                "module_url": f"/{DOMAIN}_static/schedule-panel.js?v={version}",
                "embed_iframe": False,
                "trust_external": False,
            }
        },
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    frontend.async_remove_panel(hass, "schedules")
    return True
