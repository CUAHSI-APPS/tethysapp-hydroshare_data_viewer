from tethys_sdk.base import TethysAppBase, url_map_maker


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
                name='get-layers',
                url='hydroshare-gis-data-viewer/get-layers',
                controller='hydroshare_gis_data_viewer.controllers.get_layers'
            ),
            UrlMap(
                name='get-attribute-table',
                url='hydroshare-gis-data-viewer/get-attribute-table',
                controller='hydroshare_gis_data_viewer.controllers.get_attribute_table'
            ),
            UrlMap(
                name='get-layer-list',
                url='hydroshare-gis-data-viewer/get-layer-list',
                controller='hydroshare_gis_data_viewer.controllers.get_layer_list'
            ),
        )

        return url_maps
