from django.shortcuts import render
from django.http import JsonResponse
from lxml import etree
import requests
import json
from .utilities import get_layer_code, get_layer_properties


def home(request):
    """
    Controller for the app home page.
    """

    context = {}

    return render(request, 'hydroshare_gis_data_viewer/home.html', context)


def get_layers(request):
    """
    AJAX Controller for getting HydroShare resource layers.
    """

    return_obj = {
        "success": False,
        "message": None,
        "results": {}
    }

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["success"] = False
        return_obj["message"] = "Unable to communicate with server."
        return_obj["results"] = {}

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    resource_id_list = request.POST.getlist('resource_id_list[]')
    request_layer_id = request.POST.get('layer_id')
    request_type = request.POST.get('request_type')

    # --------------------------------------- #
    #   GETS HYDROSHARE RESOURCE LAYER DATA   #
    # --------------------------------------- #

    geoserver_url = "https://geoserver.hydroshare.org/geoserver"
    hydroserver_url = "https://geoserver.hydroshare.org/hydroserver"
    layer_list = {}
    for resource_id in resource_id_list:
        request_url = f"{geoserver_url}/wms?service=WMS&request=GetCapabilities&version=1.3.0&namespace=HS-{resource_id}"
        response = requests.get(request_url)
        root = etree.fromstring(response.content)
        for layer in list(root.iter("{http://www.opengis.net/wms}Layer"))[1:]:
            layer_id = layer.find("{http://www.opengis.net/wms}Name").text
            print(request_layer_id)
            if request_layer_id != "" and request_layer_id != layer_id:
                print('skipping')
                continue
            layer_code = get_layer_code()
            layer_name = ":".join(layer_id.split(":")[1:])
            bounding_box = layer.find("{http://www.opengis.net/wms}EX_GeographicBoundingBox")
            min_x = bounding_box.find("{http://www.opengis.net/wms}westBoundLongitude").text
            min_y = bounding_box.find("{http://www.opengis.net/wms}southBoundLatitude").text
            max_x = bounding_box.find("{http://www.opengis.net/wms}eastBoundLongitude").text
            max_y = bounding_box.find("{http://www.opengis.net/wms}northBoundLatitude").text
            layer_type_list = {
                "Default Point": "point",
                "Default Line": "line",
                "Default Polygon": "polygon",
                "Default raster style": "raster"
            }
            layer_type = layer_type_list.get(layer.find("{http://www.opengis.net/wms}Style").find("{http://www.opengis.net/wms}Title").text)
            if layer_type == "raster":
                layer_properties = get_layer_properties(layer_type, layer_id)
            else:
                layer_properties = []
            layer_list[layer_code] = {
                "layerName": layer_name,
                "layerId": layer_id,
                "layerType": layer_type,
                "layerExtent": {
                    "minX": min_x,
                    "minY": min_y,
                    "maxX": max_x,
                    "maxY": max_y
                },
                "layerProperties": layer_properties,
            }

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj["success"] = True
    return_obj["message"] = request_type
    return_obj["results"] = layer_list

    return JsonResponse(return_obj)


def get_layer_list(request):
    """
    AJAX Controller for getting layer list.
    """

    return_obj = {
        "success": False,
        "message": None,
        "results": {}
    }

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["success"] = False
        return_obj["message"] = "Unable to communicate with server."
        return_obj["results"] = {}

        return JsonResponse(return_obj)

    # ------------------- #
    #   GETS LAYER LIST   #
    # ------------------- #

    geoserver_url = "https://geoserver.hydroshare.org/geoserver"
    layer_list = []

    # Get Vector Layers
    request_url = f"{geoserver_url}/wfs/"
    params = {
        "service": "WFS",
        "version": "1.3.0",
        "request": "getCapabilities"
    }
    response = requests.get(request_url, params=params)
    wfs_capabilities = etree.fromstring(response.content)
    wfs_layer_list = [i.text for i in list(wfs_capabilities.iter("{http://www.opengis.net/wfs}Name"))]
    for wfs_layer in wfs_layer_list:
        if wfs_layer.split(":")[0] != "hydroshare":
            layer_list.append({
                "id": wfs_layer,
                "name": ":".join(wfs_layer.split(":")[1:]),
                "resource_id": wfs_layer.split(":")[0].split("-")[1],
                "type": "VECTOR"
            })

    # Get Raster Layers
    request_url = f"{geoserver_url}/wcs/"
    params = {
        "service": "WCS",
        "version": "2.0.1",
        "request": "getCapabilities"
    }
    response = requests.get(request_url, params=params)
    wcs_capabilities = etree.fromstring(response.content)
    wcs_layer_list = [i.text for i in list(wcs_capabilities.iter("{http://www.opengis.net/wcs/2.0}CoverageId"))]
    for wcs_layer in wcs_layer_list:
        if wcs_layer.split("__")[0] != "hydroshare":
            layer_list.append({
                "id": wcs_layer.replace("__", ":", 1),
                "name": "__".join(wcs_layer.split("__")[1:]),
                "resource_id": wcs_layer.split("__")[0].split("-")[1],
                "type": "RASTER"
            })

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj["success"] = True
    return_obj["results"] = layer_list

    return JsonResponse(return_obj) 


def get_attribute_table(request):
    """
    AJAX Controller for getting layer attribute table.
    """

    return_obj = {
        "success": False,
        "message": None,
        "results": {}
    }

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["success"] = False
        return_obj["message"] = "Unable to communicate with server."
        return_obj["results"] = {}

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    layer_id = request.POST.get("layer_id")
    layer_code = request.POST.get("layer_code")

    # ----------------------- #
    #   GETS ATTRIBUTE DATA   #
    # ----------------------- #

    geoserver_url = "https://geoserver.hydroshare.org/geoserver"
    params = {
        "service": "WFS",
        "version": "1.3.0",
        "request": "describeFeatureType",
        "typeName": layer_id,
        "outputFormat": "application/json"
    }
    request_url = f"{geoserver_url}/wfs/"
    response = requests.get(request_url, params=params)

    layer_properties = {
        "properties": [],
        "values": []
    }
    values = []

    for attr in json.loads(response.content)["featureTypes"][0]["properties"]:
        if attr["name"] != 'the_geom':
            params = {
                "service": "WFS",
                "version": "1.3.0",
                "request": "GetFeature",
                "typeName": layer_id,
                "propertyName": attr["name"],
                "outputFormat": "application/json",
                "startIndex": 0,
                "count": 100000
            }
            request_url = f"{geoserver_url}/wfs/"
            response = requests.get(request_url, params=params)
            layer_properties["properties"].append(attr["name"])
            values.append([i["properties"][attr["name"]] for i in json.loads(response.content)["features"]])
    layer_properties["values"] = list(map(list, zip(*values)))
    print("FINISHED")

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj["success"] = True
    return_obj["results"]["layer_properties"] = layer_properties
    return_obj["results"]["layer_code"] = layer_code

    return JsonResponse(return_obj)  
