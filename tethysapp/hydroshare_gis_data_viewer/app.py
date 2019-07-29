from tethys_sdk.base import TethysAppBase, url_map_maker
from tethys_sdk.app_settings import CustomSetting


class HydroshareGisDataViewer(TethysAppBase):
    """
    Tethys app class for HydroShare GIS Data Viewer.
    """

    name = 'HydroShare GIS Data Viewer'
    index = 'hydroshare_gis_data_viewer:home'
    icon = 'hydroshare_gis_data_viewer/images/cuahsi_logo.png'
    package = 'hydroshare_gis_data_viewer'
    root_url = 'hydroshare-gis-data-viewer'
    color = '#008080'
    description = 'This app allows users to view HydroShare geographic feature and raster content.'
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
                url='hydroshare-gis-data-viewer',
                controller='hydroshare_gis_data_viewer.controllers.home'
            ),
            UrlMap(
                name='get-hydroshare-layers',
                url='hydroshare-gis-data-viewer/get-hydroshare-layers',
                controller='hydroshare_gis_data_viewer.ajax_controllers.get_hydroshare_layers'
            ),
            UrlMap(
                name='get-attribute-table',
                url='hydroshare-gis-data-viewer/get-attribute-table',
                controller='hydroshare_gis_data_viewer.ajax_controllers.get_attribute_table'
            ),
            UrlMap(
                name='get-discovery-layer-list',
                url='hydroshare-gis-data-viewer/get-discovery-layer-list',
                controller='hydroshare_gis_data_viewer.ajax_controllers.get_discovery_layer_list'
            ),
            UrlMap(
                name='get-timeseries-data',
                url='hydroshare-gis-data-viewer/get-timeseries-data',
                controller='hydroshare_gis_data_viewer.ajax_controllers.get_timeseries_data'
            ),
        )

        return url_maps

    def custom_settings(self):
        custom_settings = (
            CustomSetting(
                name='geoserver_url',
                type=CustomSetting.TYPE_STRING,
                description='GeoServer URL',
                required=True
            ),
            CustomSetting(
                name='hydroserver_url',
                type=CustomSetting.TYPE_STRING,
                description='HydroServer URL',
                required=True
            ),
        )

        return custom_settings
