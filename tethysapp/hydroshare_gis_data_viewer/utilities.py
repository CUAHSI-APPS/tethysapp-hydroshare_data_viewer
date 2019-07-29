import random
import string
import requests
from lxml import etree


def get_layer_code():
	return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))


def get_layer_properties(layer_type, layer_id):
	workspace_id = layer_id.split(":")[0]
	layer_id = ":".join(layer_id.split(":")[1:])
	layer_properties = []

	if layer_type == "point" or layer_type == "line" or layer_type == "polygon":
		pass

	if layer_type == "raster":
		geoserver_url = "https://geoserver-beta.hydroshare.org/geoserver"
		request_url = f"{geoserver_url}/rest/workspaces/{workspace_id}/styles/{layer_id}.sld"
		response = requests.get(request_url)
		root = etree.fromstring(response.content)
		layer_properties.append({})
		layer_properties[0]["property"] = "raster"
		layer_property_values = list(root.iter("{http://www.opengis.net/sld}ColorMapEntry"))
		layer_properties[0]["ndv_value"] = float(layer_property_values[0].attrib["quantity"])
		layer_properties[0]["min_value"] = float(layer_property_values[1].attrib["quantity"])
		layer_properties[0]["max_value"] = float(layer_property_values[2].attrib["quantity"])
		
	return layer_properties
