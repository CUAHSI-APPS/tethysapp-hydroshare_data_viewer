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
        )

        return url_maps
