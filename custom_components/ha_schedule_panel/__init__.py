"""The HA Schedule Panel integration."""
import os
import logging
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "ha_schedule_panel"

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the HA Schedule Panel component."""
    
    # Get the directory of this integration
    integration_dir = os.path.dirname(__file__)
    frontend_dir = os.path.join(integration_dir, "frontend")

    # Register the static path so HA can serve the JS file
    # We serve it at /ha_schedule_panel_static
    hass.http.register_static_path(
        f"/{DOMAIN}_static",
        frontend_dir,
        cache_headers=False
    )

    # Register the custom panel
    _LOGGER.info("Registering HA Schedule Panel in sidebar")
    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title="Schedules",
        sidebar_icon="mdi:calendar-clock",
        frontend_url_path="schedules",
        require_admin=False,
        config={
            "_panel_custom": {
                "name": "schedule-panel",
                "module_url": f"/{DOMAIN}_static/schedule-panel.js",
                "embed_iframe": False,
                "trust_external": False,
            }
        },
    )

    return True
