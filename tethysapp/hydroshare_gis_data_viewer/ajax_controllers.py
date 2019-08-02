import requests
import json
from django.http import JsonResponse
from lxml import etree
from .app import HydroshareGisDataViewer as app
from .utilities import get_layer_code, get_layer_properties


def get_hydroshare_layers(request):
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

    geoserver_url = app.get_custom_setting("geoserver_url")
    hydroserver_url = app.get_custom_setting("hydroserver_url")

    layer_list = {}
    for resource_id in resource_id_list:

        if geoserver_url != "None":

            # Gets list of available GeoServer Layers
            request_url = f"{geoserver_url}/wms?service=WMS&request=GetCapabilities&version=1.3.0&namespace=HS-{resource_id}"
            response = requests.get(request_url)
            root = etree.fromstring(response.content)
            if request_layer_id[:3] != "HS-" and request_layer_id != "":
                request_layer_id_gs = "HS-" + request_layer_id
            else:
                request_layer_id_gs = request_layer_id

            for layer in list(root.iter("{http://www.opengis.net/wms}Layer"))[1:]:
                layer_id = layer.find("{http://www.opengis.net/wms}Name").text
                if request_layer_id_gs != "" and request_layer_id_gs != layer_id:
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

        if hydroserver_url != "None":
            request_url = f"{hydroserver_url}/manage/network/{resource_id}/databases/"
            response = requests.get(request_url)
            try:
                database_list = json.loads(response.content)
            except:
                database_list = []

            for database in database_list:
                database_id = database["database_id"]
                if request_layer_id != "" and request_layer_id != f"{resource_id}:{database_id}":
                    continue
                layer_code = get_layer_code()
                layer_name = database["database_name"]
                request_url = f"{hydroserver_url}/refts/catalog/?network_id={resource_id}&database_id={database_id}"
                response = requests.get(request_url)
                refts_object = json.loads(response.content)
                geojson_object = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": [
                                    x["site"]["longitude"],
                                    x["site"]["latitude"]
                                ]
                            }
                        } for x in refts_object["timeSeriesReferenceFile"]["referencedTimeSeries"]
                    ]
                }
                layer_list[layer_code] = {
                    "layerName": layer_name,
                    "layerId": f"{resource_id}:{database_id}",
                    "layerType": "timeseries",
                    "layerGeometry": geojson_object,
                    "layerExtent": {
                        "minX": min([x["site"]["longitude"] for x in refts_object["timeSeriesReferenceFile"]["referencedTimeSeries"]]),
                        "minY": min([x["site"]["latitude"] for x in refts_object["timeSeriesReferenceFile"]["referencedTimeSeries"]]),
                        "maxX": max([x["site"]["longitude"] for x in refts_object["timeSeriesReferenceFile"]["referencedTimeSeries"]]),
                        "maxY": max([x["site"]["latitude"] for x in refts_object["timeSeriesReferenceFile"]["referencedTimeSeries"]])
                    },
                    "layerProperties": []
                }

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj["success"] = True
    return_obj["message"] = request_type
    return_obj["results"] = layer_list

    return JsonResponse(return_obj)


def get_discovery_layer_list(request):
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

    geoserver_url = app.get_custom_setting("geoserver_url")
    hydroserver_url = app.get_custom_setting("hydroserver_url")
    layer_list = []

    # Get Vector Layers
    if geoserver_url != "None":
        print(":::::::::::")
        print(geoserver_url)
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
    if geoserver_url != "None":
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

    # Get Time Series Layers
    if hydroserver_url != "None":
        request_url = f"{hydroserver_url}/manage/databases"
        response = requests.get(request_url)
        database_list = json.loads(response.content)
        for database in database_list:
            layer_list.append({
                "id": database["database_id"],
                "name": database["database_name"],
                "resource_id": database["network_id"],
                "type": "TIMESERIES"
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
    layer_type = request.POST.get("layer_type")

    # ----------------------- #
    #   GETS ATTRIBUTE DATA   #
    # ----------------------- #

    if layer_type == "point" or layer_type == "line" or layer_type == "polygon":
        geoserver_url = "https://geoserver-beta.hydroshare.org/geoserver"
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

    elif layer_type == "timeseries":
        hydroserver_url = "https://geoserver-beta.hydroshare.org/wds"
        resource_id = layer_id.split(":")[0]
        database_id = ":".join(layer_id.split(":")[1:])
        request_url = f"{hydroserver_url}/refts/catalog/?network_id={resource_id}&database_id={database_id}"
        response = requests.get(request_url)
        refts_object = json.loads(response.content)
        layer_properties = {
            "properties": [
                "Site Name",
                "Site Code",
                "Variable Name",
                "Variable Code",
                "Sample Medium",
                "Start Date",
                "End Date",
                "Value Count",
                "Method Link",
                "Method Description",
                "Latitude",
                "Longitude"
            ],
            "values": [
                [
                    x["site"]["siteName"],
                    x["site"]["siteCode"],
                    x["variable"]["variableName"],
                    x["variable"]["variableCode"],
                    x["sampleMedium"],
                    x["beginDate"],
                    x["endDate"],
                    x["valueCount"],
                    x["method"]["methodLink"],
                    x["method"]["methodDescription"],
                    x["site"]["latitude"],
                    x["site"]["longitude"]
                ]
            for x in refts_object["timeSeriesReferenceFile"]["referencedTimeSeries"]]
        }

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj["success"] = True
    return_obj["results"]["layer_properties"] = layer_properties
    return_obj["results"]["layer_code"] = layer_code

    return JsonResponse(return_obj)  


def get_timeseries_data(request):
    """
    AJAX Controller for getting time series data.
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
    site_code = request.POST.get("site_code")
    variable_code = request.POST.get("var_code")
    site_name = request.POST.get("site_name")
    variable_name = request.POST.get("var_name")

    # ------------------------- #
    #   GETS TIME SERIES DATA   #
    # ------------------------- #

    network_id = layer_id.split(":")[0]
    database_id = ":".join(layer_id.split(":")[1:])
    hydroserver_url = "https://geoserver-beta.hydroshare.org/wds"
    request_url = f"{hydroserver_url}/wof/{network_id}/{database_id}/values/"
    params = {
        "site_code": site_code,
        "variable_code": variable_code
    }
    response = requests.get(request_url, params=params)
    waterml = etree.fromstring(response.content)
    no_data_value = waterml.find("{http://www.cuahsi.org/waterML/1.1/}timeSeries").find("{http://www.cuahsi.org/waterML/1.1/}variable").find("{http://www.cuahsi.org/waterML/1.1/}noDataValue").text
    try:
        unit_name = waterml.find("{http://www.cuahsi.org/waterML/1.1/}timeSeries").find("{http://www.cuahsi.org/waterML/1.1/}variable").find("{http://www.cuahsi.org/waterML/1.1/}unit").find("{http://www.cuahsi.org/waterML/1.1/}unitAbbreviation").text
    except:
        unit_name = None
    timeseries_data = [[
        x.get('dateTime'),
        x.text if x.text != no_data_value else None
    ] for x in waterml.find("{http://www.cuahsi.org/waterML/1.1/}timeSeries").find("{http://www.cuahsi.org/waterML/1.1/}values").iter("{http://www.cuahsi.org/waterML/1.1/}value")]

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj["success"] = True
    return_obj["results"]["timeseries_data"] = timeseries_data
    return_obj["results"]["no_data_value"] = no_data_value
    return_obj["results"]["site_name"] = site_name
    return_obj["results"]["variable_name"] = variable_name
    return_obj["results"]["unit_name"] = unit_name

    return JsonResponse(return_obj)  
