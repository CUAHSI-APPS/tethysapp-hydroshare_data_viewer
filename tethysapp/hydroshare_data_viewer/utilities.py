import random
import string
import requests
import json
import random
from lxml import etree
from .app import HydroshareDataViewer as app

geoserver_url = app.get_custom_setting("geoserver_url")
hydroserver_url = app.get_custom_setting("hydroserver_url")
include_feature = app.get_custom_setting("include_feature")
include_raster = app.get_custom_setting("include_raster")
include_timeseries = app.get_custom_setting("include_timeseries")


def get_layers(resource_id):
    """
    Get list of layers for a resource.

    This function takes a resource ID and retrieves a list of vector, raster,
    and timeseries layers associated with the resource.
    """

    layer_list = []

    # Get Vector Layers
    if geoserver_url != "None" and include_feature:
        request_url = f"{geoserver_url}/wfs/"
        params = {
            "service": "WFS",
            "version": "1.3.0",
            "request": "getCapabilities",
            "namespace": "HS-" + resource_id
        }
        response = requests.get(request_url, params=params)
        wfs_capabilities = etree.fromstring(response.content)
        wfs_layer_list = list(wfs_capabilities.iter("{http://www.opengis.net/wfs}FeatureType"))
        for wfs_layer in wfs_layer_list:
            wfs_layer_code = wfs_layer.find("{http://www.opengis.net/wfs}Name").text
            request_url = f"{geoserver_url}/rest/layers/{wfs_layer_code}.json"
            response = requests.get(request_url)
            layer_type = json.loads(response.content)["layer"]["defaultStyle"]["name"]
            layer_fields = get_layer_fields(layer_type, wfs_layer_code, resource_id)
            layer_list.append({
                "layerCode": wfs_layer_code,
                "layerName": ":".join(wfs_layer_code.split(":")[1:]),
                "resourceId": resource_id,
                "layerCoverage": get_layer_coverage(layer_type, wfs_layer),
                "layerType": layer_type,
                "layerFields": layer_fields,
                "layerSymbology": get_layer_symbology(layer_type, layer_fields),
                "layerVisible": True,
                "layerOrder": 0
            })

    # Get Raster Layers
    if geoserver_url != "None" and include_raster:
        request_url = f"{geoserver_url}/wcs/"
        params = {
            "service": "WCS",
            "version": "1.1.1",
            "request": "getCapabilities",
            "namespace": "HS-" + resource_id
        }
        response = requests.get(request_url, params=params)
        wcs_capabilities = etree.fromstring(response.content)
        wcs_layer_list = list(wcs_capabilities.iter("{http://www.opengis.net/wcs/1.1.1}CoverageSummary"))
        for wcs_layer in wcs_layer_list:
            wcs_layer_code = wcs_layer.find("{http://www.opengis.net/wcs/1.1.1}Identifier").text
            layer_fields = get_layer_fields("raster", wcs_layer_code, resource_id)
            layer_list.append({
                "layerCode": wcs_layer_code,
                "layerName": ":".join(wcs_layer_code.split(":")[1:]),
                "resourceId": resource_id,
                "layerCoverage": get_layer_coverage("raster", wcs_layer),
                "layerType": "raster",
                "layerFields": layer_fields,
                "layerSymbology": get_layer_symbology("raster", layer_fields),
                "layerVisible": True
            })

    # Get Time Series Layers
    if hydroserver_url != "None" and geoserver_url != "None" and include_timeseries:
        request_url = f"{geoserver_url}/wfs/"
        params = {
            "service": "WFS",
            "version": "1.3.0",
            "request": "getCapabilities",
            "namespace": "TS-" + resource_id
        }
        response = requests.get(request_url, params=params)
        wfs_capabilities = etree.fromstring(response.content)
        wfs_layer_list = list(wfs_capabilities.iter("{http://www.opengis.net/wfs}FeatureType"))
        for wfs_layer in wfs_layer_list:
            wfs_layer_code = wfs_layer.find("{http://www.opengis.net/wfs}Name").text
            layer_fields = get_layer_fields("timeseries", wfs_layer_code, resource_id)
            layer_list.append({
                "layerCode": wfs_layer_code,
                "layerName": ":".join(wfs_layer_code.split(":")[1:]),
                "resourceId": resource_id,
                "layerCoverage": get_layer_coverage("timeseries", wfs_layer),
                "layerType": "timeseries",
                "layerFields": layer_fields,
                "layerSymbology": get_layer_symbology("timeseries", layer_fields),
                "layerVisible": True
            })

    return layer_list


def get_layer_fields(layer_type, layer_code, resource_id):
    """
    Gets fields for a layer.

    Determines fields for vector layers.
    """

    if layer_type == "raster":
        return [{
            "fieldName": "coverage", 
            "fieldType": "numerical",
            "fieldStats": get_field_stats("raster", layer_code, resource_id, "coverage", "numerical")
        }]
    else:
        request_url = f"{geoserver_url}/wfs/?service=WFS&request=describeFeatureType&version=1.1.0&typename={layer_code}"
        response = next(etree.fromstring(requests.get(request_url).content).iter("{http://www.w3.org/2001/XMLSchema}sequence"))
        return [{
            "fieldName": i.get("name"),
            "fieldType": "numerical" if i.get("type") in ("xsd:long", "xsd:int", "xsd:double", "xsd:float") else "categorical",
            "fieldStats": None
        } for i in list(response.iter("{http://www.w3.org/2001/XMLSchema}element"))[1:]]


def get_field_stats(layer_type, layer_code, resource_id, field_name, field_type):
    """
    Gets statistics for a field.

    Determines field statistics for vector layers and coverage
    statistics for raster layers.
    """

    if layer_type == "raster":
        request_url = f"{geoserver_url}/rest/workspaces/{'HS-' + resource_id}/styles/{':'.join(layer_code.split(':')[1:])}.sld"
        response = requests.get(request_url)
        root = etree.fromstring(response.content)
        layer_raster_stats = list(root.iter("{http://www.opengis.net/sld}ColorMapEntry"))
        return {
            "min": float(layer_raster_stats[1].attrib["quantity"]),
            "max": float(layer_raster_stats[2].attrib["quantity"]),
            "ndv": float(layer_raster_stats[0].attrib["quantity"])
        }
    else:
        request_url = f"{geoserver_url}/wfs?service=WFS&version=1.1.0&request=GetFeature&typename={layer_code}&maxFeatures=1&sortBy={field_name}+D&propertyName={field_name}"
        response = requests.get(request_url)
        max_value = str(response.content).split(f"{layer_code.split(':')[0]}:{field_name}")[1][1:-2]
        request_url = f"{geoserver_url}/wfs?service=WFS&version=1.1.0&request=GetFeature&typename={layer_code}&maxFeatures=1&sortBy={field_name}+A&propertyName={field_name}"
        response = requests.get(request_url)
        min_value = str(response.content).split(f"{layer_code.split(':')[0]}:{field_name}")[1][1:-2]
        return {
            "min": float(min_value),
            "max": float(max_value)
        }


def get_layer_coverage(layer_type, layer_response):
    """
    Gets coverage for a layer.

    Determines the bounding box for vector and
    raster layers.
    """

    if layer_type == "raster":
        ns = "{http://www.opengis.net/ows/1.1}"
    else:
        ns = "{http://www.opengis.net/ows}"
    return {
        "maxX": float(next(layer_response.iter(f"{ns}UpperCorner")).text.split(" ")[0]),
        "maxY": float(next(layer_response.iter(f"{ns}UpperCorner")).text.split(" ")[1]),
        "minX": float(next(layer_response.iter(f"{ns}LowerCorner")).text.split(" ")[0]),
        "minY": float(next(layer_response.iter(f"{ns}LowerCorner")).text.split(" ")[1])
    }


def get_layer_symbology(layer_type, layer_fields):
    """
    Gets default symbology for a layer.

    Defines default symbology metadata for points, lines,
    polygons, rasters, and timeseries.
    """

    initial_colors = [
        "#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#cfe2f3","#d9d2e9","#ead1dc",
        "#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#9fc5e8","#b4a7d6","#d5a6bd",
        "#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6fa8dc","#8e7cc3","#c27ba0",
        "#c00","#e69138","#f1c232","#6aa84f","#45818e","#3d85c6","#674ea7","#a64d79"
    ]
    if layer_type == "point" or layer_type == "timeseries":
        num_fields = [i["fieldName"] for i in layer_fields if i["fieldType"] == "numerical"]
        if num_fields:
            fill_field = num_fields[0]
        else:
            fill_field = None
        return {
            "fillType": "simple",
            "fillShape": "circle",
            "fillColor": random.choice(initial_colors),
            "fillOpacity": 1,
            "fillField": fill_field,
            "fillGradient": "gray",
            "fillSize": 10,
            "strokeColor": "#000000",
            "strokeOpacity": 1,
            "strokeSize": 1,
            "labelField": "none",
            "labelColor": "#000000",
            "labelSize": 12,
            "labelOpacity": 1,
            "labelFont": "SansSerif"
        }
    elif layer_type == "line":
        num_fields = [i["fieldName"] for i in layer_fields if i["fieldType"] == "numerical"]
        if num_fields:
            stroke_field = num_fields[0]
        else:
            stroke_field = None
        return {
            "strokeType": "simple",
            "strokeField": stroke_field,
            "strokeGradient": "gray",
            "strokeColor": random.choice(initial_colors),
            "strokeOpacity": 1,
            "strokeSize": 1,
            "labelField": "none",
            "labelColor": "#000000",
            "labelSize": 12,
            "labelOpacity": 1,
            "labelFont": "SansSerif"
        }
    elif layer_type == "polygon":
        num_fields = [i["fieldName"] for i in layer_fields if i["fieldType"] == "numerical"]
        if num_fields:
            fill_field = num_fields[0]
        else:
            fill_field = None
        return {
            "fillType": "simple",
            "fillColor": random.choice(initial_colors),
            "fillOpacity": 1,
            "fillField": fill_field,
            "fillGradient": "gray",
            "strokeColor": "#000000",
            "strokeOpacity": 1,
            "strokeSize": 1,
            "labelField": "none",
            "labelColor": "#000000",
            "labelSize": 12,
            "labelOpacity": 1,
            "labelFont": "SansSerif"
        }
    elif layer_type == "raster":
        return {
            "fillType": "gradient",
            "fillOpacity": 1,
            "fillField": "coverage",
            "fillGradient": "gray",
            "labelField": "none"
        }
