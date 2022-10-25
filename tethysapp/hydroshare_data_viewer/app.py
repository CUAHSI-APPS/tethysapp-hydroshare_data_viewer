from tethys_sdk.base import TethysAppBase, url_map_maker
from tethys_sdk.app_settings import CustomSetting


class HydroshareDataViewer(TethysAppBase):
    """
    Tethys app class for HydroShare Data Viewer.
    """

    name = 'HydroShare Data Viewer'
    index = 'home'
    icon = 'hydroshare_data_viewer/images/data-viewer.png'
    package = 'hydroshare_data_viewer'
    root_url = 'hydroshare-data-viewer'
    color = '#008080'
    description = 'This app is designed to run on Tethys Platform and helps support CUAHSI\'s HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.'
    tags = ''
    enable_feedback = False
    feedback_emails = []
    controller_modules = ['controllers', 'ajax_controllers', ]

    def custom_settings(self):
        custom_settings = (
            CustomSetting(
                name='hydroshare_url',
                type=CustomSetting.TYPE_STRING,
                description='HydroShare URL to connect to.',
                required=False
            ),
            CustomSetting(
                name='geoserver_url',
                type=CustomSetting.TYPE_STRING,
                description='GeoServer URL to connect to.',
                required=False
            ),
            CustomSetting(
                name='hydroserver_url',
                type=CustomSetting.TYPE_STRING,
                description='HydroServer URL to connect to.',
                required=False
            ),
            CustomSetting(
                name='include_feature',
                type=CustomSetting.TYPE_BOOLEAN,
                description='Include Geographic Feature content?',
                required=False
            ),
            CustomSetting(
                name='include_raster',
                type=CustomSetting.TYPE_BOOLEAN,
                description='Include Geographic Raster content?',
                required=False
            ),
            CustomSetting(
                name='include_timeseries',
                type=CustomSetting.TYPE_BOOLEAN,
                description='Include Time Series content?',
                required=False
            ),
            CustomSetting(
                name='max_layers',
                type=CustomSetting.TYPE_INTEGER,
                description='Maximum number of layers allowed in the workspace.',
                required=False
            ),
        )

        return custom_settings
