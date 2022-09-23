from tethys_sdk.base import TethysAppBase, url_map_maker
from tethys_sdk.app_settings import CustomSetting


class HydroshareDataViewer(TethysAppBase):
    """
    Tethys app class for HydroShare Data Viewer.
    """

    name = 'HydroShare Data Viewer'
    index = 'hydroshare_data_viewer:home'
    icon = 'hydroshare_data_viewer/images/data-viewer.png'
    package = 'hydroshare_data_viewer'
    root_url = 'hydroshare-data-viewer'
    color = '#008080'
    description = 'This app is designed to run on Tethys Platform and helps support CUAHSI\'s HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.'
    tags = ''
    enable_feedback = False
    feedback_emails = []

    def url_maps(self):
        """
        Add controllers
        """
        UrlMap = url_map_maker(self.root_url)

        url_maps = (
            UrlMap(
                name='home',
                url='hydroshare-data-viewer',
                controller='hydroshare_data_viewer.controllers.home'
            ),
            UrlMap(
                name='update-discover-table',
                url='hydroshare-data-viewer/ajax/update-discover-table',
                controller='hydroshare_data_viewer.ajax_controllers.update_discover_table'
            ),
            UrlMap(
                name='get-resource-metadata',
                url='hydroshare-data-viewer/ajax/get-resource-metadata',
                controller='hydroshare_data_viewer.ajax_controllers.get_resource_metadata'
            ),
            UrlMap(
                name='get-field-statistics',
                url='hydroshare-data-viewer/ajax/get-field-statistics',
                controller='hydroshare_data_viewer.ajax_controllers.get_field_statistics'
            ),
            UrlMap(
                name='update-attribute-table',
                url='hydroshare-data-viewer/ajax/update-attribute-table',
                controller='hydroshare_data_viewer.ajax_controllers.update_attribute_table'
            ),
            UrlMap(
                name='select-feature',
                url='hydroshare-data-viewer/ajax/select-feature',
                controller='hydroshare_data_viewer.ajax_controllers.select_feature'
            ),
            UrlMap(
                name='get-timeseries-data',
                url='hydroshare-data-viewer/ajax/get-timeseries-data',
                controller='hydroshare_data_viewer.ajax_controllers.get_timeseries_data'
            )
        )

        return url_maps

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
