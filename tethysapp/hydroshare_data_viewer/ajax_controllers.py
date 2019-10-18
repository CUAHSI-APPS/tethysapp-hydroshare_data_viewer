import requests
import json
import time
from django.http import JsonResponse
from lxml import etree
from .app import HydroshareDataViewer as app
from .utilities import get_layers, get_field_stats

geoserver_url = app.get_custom_setting("geoserver_url")
hydroserver_url = app.get_custom_setting("hydroserver_url")


def update_discover_table(request):
    """
    Loads data for Datatables.

    This function handles Datatables server-side processing. Returns filtered
    paged resource list results to the client to be displayed to the user in
    the discover table.
    """

    return_obj = {}

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["error"] = "Unable to establish a secure connection."

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    draw = request.POST.get('draw')
    search_value = request.POST.get('searchValue')
    length = int(request.POST.get('length'))
    start = int(request.POST.get('start'))

    # ---------------------- #
    #   GETS FILTERED DATA   #
    # ---------------------- #

    hydroshare_url = app.get_custom_setting("hydroshare_url")
    search_param = f"&text={search_value}" if search_value else ""

    page, r = divmod(start, length)

    request_url_upper = f"{hydroshare_url}/hsapi/resource/search?resource_type=Composite%20Resource&page={page+1}&count={length}{search_param}"
    request_url_lower = f"{hydroshare_url}/hsapi/resource/search?resource_type=Composite%20Resource&page={page+2}&count={length}{search_param}"
    response_upper = requests.get(request_url_upper)
    response_lower = requests.get(request_url_lower)
    results_upper = json.loads(response_upper.content)
    results_lower = json.loads(response_lower.content)

    try:
        records = results_upper.get("count")
        data_upper = [[i["resource_type"], i["text"].split("\n")[3].strip(), i["text"].split("\n")[1].strip()] for i in results_upper["results"]][r:]
    except:
        records = "0"
        data_upper = []
    try:
        data_lower = [[i["resource_type"], i["text"].split("\n")[3].strip(), i["text"].split("\n")[1].strip()] for i in results_lower["results"]][:-int(length - r)]
    except:
        data_lower = []

    # -------------------- #
    #   RETURNS RESPONSE   #
    # -------------------- #

    return_obj["draw"] = [int(draw)]
    return_obj["recordsTotal"] = records
    return_obj["recordsFiltered"] = records
    return_obj["data"] = data_upper + data_lower

    return JsonResponse(return_obj)


def get_resource_metadata(request):
    """
    Gets resource metadata and aggregations.

    This function retrieves a given resource's metadata to display in the
    resource info tab. It will also get a list of available 
    """

    return_obj = {}

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["error"] = "Unable to establish a secure connection."

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    resource_id = request.POST.get('resourceId')

    # -------------------------- #
    #   GETS RESOURCE METADATA   #
    # -------------------------- #

    hydroshare_url = app.get_custom_setting("hydroshare_url")
    geoserver_url = app.get_custom_setting("geoserver_url")
    hydroserver_url = app.get_custom_setting("hydroserver_url")

    request_url = f"{hydroshare_url}/hsapi/resource/{resource_id}/sysmeta/"
    response = json.loads(requests.get(request_url).content)

    if response["public"] is True:
        sharing_status = "Public"
    elif response["discoverable"] is True:
        sharing_status = "Discoverable"
    else:
        sharing_status = "Private"

    bounding_box = None
    coverages = [coverage for coverage in response["coverages"] if coverage["type"] in ("point", "box")]
    for coverage in response["coverages"]:
        if coverage["type"] == "point":
            bounding_box = {
                "min_x": coverage["value"]["east"],
                "min_y": coverage["value"]["north"],
                "max_x": coverage["value"]["east"],
                "max_y": coverage["value"]["north"]
            }
        elif coverage["type"] == "box":
            bounding_box = {
                "min_x": coverage["value"]["westlimit"],
                "min_y": coverage["value"]["southlimit"],
                "max_x": coverage["value"]["eastlimit"],
                "max_y": coverage["value"]["northlimit"],
            }

    layer_list = get_layers(resource_id)

    # -------------------- #
    #   RETURNS RESPONSE   #
    # -------------------- #

    return_obj["resourceTitle"] = response["resource_title"]
    return_obj["resourceAbstract"] = response["abstract"]
    return_obj["creator"] = response["creator"]
    return_obj["dateCreated"] = response["date_created"]
    return_obj["lastUpdated"] = response["date_last_updated"]
    return_obj["resourceId"] = resource_id
    return_obj["resourceLink"] = response["resource_url"]
    return_obj["sharingStatus"] = sharing_status
    return_obj["resourceType"] = response["resource_type"]
    return_obj["layerList"] = layer_list
    return_obj["boundingBox"] = bounding_box

    return JsonResponse(return_obj)


def get_field_statistics(request):
    """
    Gets field statistics.

    This function gets statistics metadata for a layer field.
    """

    return_obj = {}

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["error"] = "Unable to establish a secure connection."

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    layer_type = request.POST.get('layer_type')
    layer_code = request.POST.get('layer_code')
    resource_id = request.POST.get('resource_id')
    field_name = request.POST.get('field_name')
    field_type = request.POST.get('field_type')

    # ------------------------- #
    #   GETS FIELD STATISTICS   #
    # ------------------------- #

    field_statistics = get_field_stats(layer_type, layer_code, resource_id, field_name, field_type)

    # -------------------- #
    #   RETURNS RESPONSE   #
    # -------------------- #

    return_obj["min"] = field_statistics["min"]
    return_obj["max"] = field_statistics["max"]
    return_obj["layer_code"] = layer_code
    return_obj["field_name"] = field_name

    return JsonResponse(return_obj)


def update_attribute_table(request):
    """
    Loads data for Datatables.

    This function handles Datatables server-side processing. Returns filtered
    paged resource list results to the client to be displayed to the user in
    the attribute table.
    """

    return_obj = {}

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["error"] = "Unable to establish a secure connection."

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    draw = request.POST.get('draw')
    length = int(request.POST.get('length'))
    start = int(request.POST.get('start'))
    layer_fields = request.POST.getlist('layer_fields[]')
    layer_code = request.POST.get("layer_code")

    # ------------- #
    #   GETS DATA   #
    # ------------- #

    request_url = f"{geoserver_url}/wfs/"
    request_params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "GetFeature",
        "typeName": layer_code,
        "resultType": "hits"
    }
    response = requests.get(request_url, params=request_params)
    root = etree.fromstring(response.content)
    layer_count = int(next(root.iter("{http://www.opengis.net/wfs}FeatureCollection")).get("numberOfFeatures"))

    request_url = f"{geoserver_url}/wfs/"
    request_params = {
        "service": "WFS",
        "version": "1.3.0",
        "request": "GetFeature",
        "typeName": layer_code,
        "propertyName": ",".join(layer_fields),
        "outputFormat": "application/json",
        "startIndex": start,
        "count": length
    }
    response = requests.get(request_url, params=request_params)
    data = [[field["id"]] + [i + start + 1] + list(field["properties"].values()) for i, field in enumerate(json.loads(response.content)["features"])]

    # -------------------- #
    #   RETURNS RESPONSE   #
    # -------------------- #

    return_obj["draw"] = [int(draw)]
    return_obj["recordsTotal"] = layer_count
    return_obj["recordsFiltered"] = layer_count
    return_obj["data"] = data

    return JsonResponse(return_obj)


def select_feature(request):
    """
    AJAX Controller for getting selected feature.
    """

    return_obj = {}

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["error"] = "Unable to establish a secure connection."

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    feature_url = request.POST.get("feature_url")
    field_list = [i["fieldName"] for i in json.loads(request.POST.get("field_list"))["fields"]]
    layer_code = request.POST.get("layer_code")

    # ------------------- #
    #   GETS FIELD DATA   #
    # ------------------- #

    request_url = feature_url + "&propertyName" + ",".join(field_list)
    response = json.loads(requests.get(request_url).content)
    if response["features"]:
        request_url = f"{geoserver_url}/wfs/"
        request_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_code,
            "resultType": "hits"
        }
        count_response = requests.get(request_url, params=request_params)
        root = etree.fromstring(count_response.content)
        layer_count = int(next(root.iter("{http://www.opengis.net/wfs}FeatureCollection")).get("numberOfFeatures"))
        fid_list = [str(i) for i in list(range(1,layer_count + 1))]
        fid_list.sort()
        fid = response["features"][0]["id"]
        feature = fid_list.index(response["features"][0]["id"].split(".")[-1])
        row = list(response["features"][0]["properties"].values())
    else:
        fid = None
        feature = None
        row = None

    # -------------------------- #
    #   RETURNS DATA TO CLIENT   #
    # -------------------------- #

    return_obj['fid'] = fid
    return_obj['feature'] = feature
    return_obj['row'] = row
    return JsonResponse(return_obj)


def get_timeseries_data(request):
    """
    AJAX Controller for getting time series data.
    """

    return_obj = {}

    # -------------------- #
    #   VERIFIES REQUEST   #
    # -------------------- #

    if not (request.is_ajax() and request.method == "POST"):
        return_obj["error"] = "Unable to establish a secure connection."

        return JsonResponse(return_obj)

    # -------------------------- #
    #   GETS DATA FROM REQUEST   #
    # -------------------------- #

    layer_code = request.POST.get("layer_code")
    site_code = request.POST.get("site_code")
    variable_code = request.POST.get("var_code")
    site_name = request.POST.get("site_name")
    variable_name = request.POST.get("var_name")

    # ------------------------- #
    #   GETS TIME SERIES DATA   #
    # ------------------------- #

    network_id = layer_code.split(":")[0].split("-")[1]
    database_id = ":".join(layer_code.split(":")[1:])
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

    return_obj["timeseries_data"] = timeseries_data
    return_obj["no_data_value"] = no_data_value
    return_obj["site_name"] = site_name
    return_obj["variable_name"] = variable_name
    return_obj["unit_name"] = unit_name
    return_obj["variable_code"] = variable_code
    return_obj["site_code"] = site_code
    return_obj["layer_code"] = layer_code

    return JsonResponse(return_obj) 
