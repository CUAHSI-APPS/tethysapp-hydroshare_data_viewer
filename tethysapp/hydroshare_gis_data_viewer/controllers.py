from django.shortcuts import render
from .app import HydroshareGisDataViewer as app


def home(request):
    """
    Controller for the app home page.
    """

    context = {
        "geoserver_url": app.get_custom_setting("geoserver_url"),
        "hydroserver_url": app.get_custom_setting("hydroserver_url")
    }

    return render(request, 'hydroshare_gis_data_viewer/home.html', context)
