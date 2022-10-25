from django.shortcuts import render
from .app import HydroshareDataViewer as app

from tethys_sdk.routing import controller


@controller(name='home', url='hydroshare-data-viewer')
def home(request):
    """
    Controller for the app home page.

    GET requests can be launched from either HydroShare or the Tethys
    Portal. Requests can contain URL query parameters describing a resource
    or aggregation.
    """

    context = {
        "resource_id": request.GET.get("resource_id"),
        "aggregation_id": request.GET.get("aggregation_path"),
        "geoserver_url": app.get_custom_setting("geoserver_url"),
        "hydroserver_url": app.get_custom_setting("hydroserver_url"),
        "max_layers": app.get_custom_setting("max_layers")
    }

    return render(request, 'hydroshare_data_viewer/home.html', context)
