(function packageHydroShareHISDataViewer() {

    'use strict';

    /*****************************************************************************************
     *********************************** GLOBAL VARIABLES ************************************
     *****************************************************************************************/

    var map;
    var mapBasemaps;
    var layerTable;
    var layerList = {};
    var activeLayer = null;

    /*****************************************************************************************
     ******************************** FUNCTION DECLARATIONS **********************************
     *****************************************************************************************/

    /* Initializes HydroShare HIS Data Viewer App. */
    function initApp() {

        // Gets URL query parameters.
        var urlParams = new URLSearchParams(window.location.search);
        var resList = [...new Set(urlParams.getAll('res_id'))]

        // Initializes map div.
        map = new ol.Map({
            target: 'map',
            controls : ol.control.defaults({
                attribution : false,
            }),
            view: new ol.View({
                center: ol.proj.transform([0, 0], 'EPSG:4326', 'EPSG:3857'),
                zoom: 1.8,
                minZoom: 1.8,
                maxZoom: 19
            })
        });

		// Uses grab cursor when dragging the map
		map.on('pointerdrag', function(evt) {
		    map.getViewport().style.cursor = "grabbing";
		});

		map.on('pointerup', function(evt) {
		    map.getViewport().style.cursor = "default";
		});

        // Initializes Base Maps
        var satLayer = new ol.layer.Tile({
            source: new ol.source.BingMaps({
                key: 'eLVu8tDRPeQqmBlKAjcw~82nOqZJe2EpKmqd-kQrSmg~AocUZ43djJ-hMBHQdYDyMbT-Enfsk0mtUIGws1WeDuOvjY4EXCH-9OK3edNLDgkc',
                imagerySet: 'AerialWithLabels',
            })
        });
        var streetLayer = new ol.layer.Tile({
		    source: new ol.source.XYZ({ 
		        url: 'http://{1-4}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
		    })
        });  
        var greyLayer = new ol.layer.Tile({
		    source: new ol.source.XYZ({ 
		        url: 'http://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
		    })
        });
        var darkLayer = new ol.layer.Tile({
		    source: new ol.source.XYZ({ 
		        url: 'http://{1-4}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
		    })
        }); 

        map.addLayer(satLayer);
        map.addLayer(streetLayer);
        map.addLayer(greyLayer);
        map.addLayer(darkLayer);

        satLayer.setVisible(true);
        streetLayer.setVisible(false);
        greyLayer.setVisible(false);
        darkLayer.setVisible(false);

        // Initializes Layer Table
        layerTable = $('#layer-table').DataTable({
            'select': {
                'style': 'single'
            },
            'rowReorder': {
                'snapX': 0,
                'selector': 'td:nth-child(3)'
            },
            'searching': false, 
            'paging': false, 
            'info': false,
            'columnDefs': [
                {'visible': false, 'targets': [0,1]}
            ],
			'createdRow': function( row, data, dataIndex ) {
			    $(row).addClass('layer-table-row');
			}
        });

        layerTable.on('row-reorder', reorderMapLayers);
        layerTable.on('select', updateDataViewer);
        layerTable.on('deselect', disableDataViewer);

        // Adds Base Map to Layer List
        layerList['L-00000000-0000-0000-0000-000000000000'] = {
        	'layerName': 'background_map',
        	'layerType': 'basemap',
        	'layerVisible': true,
        	'displayName': 'Background Map',
        	'layer': {
        		'basemap': {
        			'zIndex': 0,
	        		'symbology': 'satellite',
	        		'satellite': satLayer,
	        		'street': streetLayer,
	        		'grey': greyLayer,
	        		'dark': darkLayer
        		}
        	}
        };

        var rowNode = layerTable.row.add([
        	1,
            'L-00000000-0000-0000-0000-000000000000',
            `<img src="http://127.0.0.1:8000/static/hydroshare_gis_data_viewer/images/basemap.svg"/>`,
            'Background Map',
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('layer-icon');
        $(rowNode).find('td').eq(1).addClass('layer-name');
        $(rowNode).find('td').eq(2).addClass('layer-move');

        // Adds HydroShare resource layers to map.
        for (var i = 0; i < resList.length; i++) {
            addHydroShareResourceLayers(resList[i]);
        };
    };

    /* Gets available layers from HydroShare resource */
    function addHydroShareResourceLayers(resId) {
    	$.ajax({
    		url: 'https://geoserver.hydroshare.org/geoserver/wms?service=WMS&request=GetCapabilities&version=1.3.0&namespace=HS-' + resId,
    		success: function(response) {
    			console.log("success");
    			var resLayerList = Array.from(response.getElementsByTagName('Layer')).slice(1);
    			var layerCodeList = [];
    			for (var i = 0; i < resLayerList.length; i++) {
    				var layerName = resLayerList[i].getElementsByTagName('Name')[0].textContent;
    				var layerTitle = resLayerList[i].getElementsByTagName('Title')[0].textContent;
    				var styleType = resLayerList[i].getElementsByTagName('Style')[0].getElementsByTagName('Title')[0].textContent
    				var minX = parseFloat(resLayerList[i].getElementsByTagName('EX_GeographicBoundingBox')[0].getElementsByTagName('westBoundLongitude')[0].textContent);
    				var minY = parseFloat(resLayerList[i].getElementsByTagName('EX_GeographicBoundingBox')[0].getElementsByTagName('southBoundLatitude')[0].textContent);
    				var maxX = parseFloat(resLayerList[i].getElementsByTagName('EX_GeographicBoundingBox')[0].getElementsByTagName('eastBoundLongitude')[0].textContent);
    				var maxY = parseFloat(resLayerList[i].getElementsByTagName('EX_GeographicBoundingBox')[0].getElementsByTagName('northBoundLatitude')[0].textContent);
    				var layerExtent = ol.proj.transformExtent([minX, minY, maxX, maxY], 'EPSG:4326', 'EPSG:3857');
    				switch(styleType) {
    					case 'Default Polygon':
    						var layerType = 'polygon';
    						break;
    					case 'Default Line':
    						var layerType = 'line';
    						break;
    					case 'Default Point':
    						var layerType = 'point';
    						break;
    					case 'Default raster style':
    						var layerType = 'raster';
    						break;
    					default:
    						break;
    				};
    				var layerCode = addLayerToMap(layerName, layerTitle, layerExtent, layerType);
    				layerCodeList.push(layerCode);
    			};
    			zoomToExtent(layerCodeList);
    		},
    		error: function(response) {
    			console.log("error")
    			console.log(response);
    		}
    	});
    };

    /* Adds a layer to the map */
    function addLayerToMap(layerName, layerTitle, layerExtent, layerType) {
    	var layerCode = createLayerCode();

        layerList[layerCode] = {
        	'layerName': layerName,
        	'layerTitle': layerTitle,
        	'layerExtent': layerExtent,
        	'layerType': layerType,
        	'layerVisible': true,
        	'displayName': layerTitle
        };

        layerList[layerCode]['layer'] = getLayerTemplate(layerType);

        if (layerType === 'polygon' || layerType === 'line' || layerType === 'raster') {
        	addWMSLayer(layerCode);
        };

        if (layerType === 'point' || layerType === 'timeseries') {
        	addWFSLayer(layerCode);
        };

        layerTable.rows().eq(0).each(function(index) {
        	var cell = layerTable.cell(index, 0);
		    cell.data(parseInt(cell.data(), 10) + 1).draw();
		});

        var rowNode = layerTable.row.add([
        	1,
            layerCode,
            createLayerIcon(layerCode),
            layerTitle,
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('layer-icon');
        $(rowNode).find('td').eq(1).addClass('layer-name');
        $(rowNode).find('td').eq(2).addClass('layer-move');

        reorderMapLayers();

        return layerCode;
    };

    /* Gets Symbology and Source Template for a Layer */
    function getLayerTemplate(layerType) {
    	switch(layerType) {
    		case 'point':
    			var layerSource = {
    				'point': {
    					'zIndex': 0,
    					'symbology': {
    						'fill': {
    							'type': 'simple',
    							'shape': 'circle',
    							'color': [220, 220, 220],
    							'colorMap': 'grey',
    							'size': 6
    						},
    						'stroke': {
    							'type': 'simple',
    							'color': [0, 0, 0],
    							'size': 1
    						},
    						'label': {
    							'type': 'simple',
    							'attribute': 'none',
    							'color': [0, 0, 0],
    							'size': 12,
    							'family': 'Times'
    						}
    					},
    					'layerSource': null,
    					'imageSource': null
    				}
    			};
    			break;
    		case 'line':
    			var layerSource = {
    				'stroke': {
    					'zIndex': 1,
    					'symbology': {
    						'type': 'simple',
    						'color': [0, 0, 0],
    						'size': 1,
    						'colorMap': 'grey'
    					},
    					'layerSource': null,
    					'rasterSource': null,
    					'imageSource': null
    				},
    				'label': {
    					'zIndex': 0,
    					'symbology': {
    						'type': 'simple',
    						'color': [0, 0, 0],
    						'size': 12,
		                	'fontAttr': 'none',
		                	'fontFamily': 'Times',
		                	'fontSize': 12,
		                	'fontColor': [0, 0, 0]
    					},
    					'layerSource': null,
    					'rasterSource': null,
    					'imageSource': null
    				}
    			};
    			break;
    		case 'polygon':
    			var layerSource = {
    				'fill': {
    					'zIndex': 2,
    					'symbology': {
    						'type': 'simple',
    						'color': [220, 220, 220],
    						'colorMap': 'grey'
    					},
    					'layerSource': null,
    					'rasterSource': null,
    					'imageSource': null
    				},
    				'stroke': {
    					'zIndex': 1,
    					'symbology': {
    						'type': 'simple',
    						'color': [0, 0, 0],
    						'size': 1
    					},
    					'layerSource': null,
    					'rasterSource': null,
    					'imageSource': null
    				},
    				'label': {
    					'zIndex': 0,
    					'symbology': {
    						'type': 'simple',
    						'color': [0, 0, 0],
    						'size': 12,
		                	'fontAttr': 'none',
		                	'fontFamily': 'Times',
		                	'fontSize': 12,
		                	'fontColor': [0, 0, 0]
    					},
    					'layerSource': null,
    					'rasterSource': null,
    					'imageSource': null
    				}
    			};
    			break;
    		case 'raster':
    			var layerSource = {
    				'raster': {
    					'zIndex': 0,
    					'symbology': {
		                	'type': 'colorMapCont',
		                	'color': [220, 220, 220],
		                	'colorMap': 'gray'
    					},
    					'layerSource': null,
    					'rasterSource': null,
    					'imageSource': null
    				}
    			};
    			break;
    	};
    	return layerSource;
    };

    /* Add WMS Layer to map */
    function addWMSLayer(layerCode) {
    	var layerName = layerList[layerCode]['layerName'];
    	var layerType = layerList[layerCode]['layerType'];
		for (var layerComponent in layerList[layerCode]['layer']) {
			var componentSymbology = layerList[layerCode]['layer'][layerComponent]['symbology'];
            var sldBody = SLD_TEMPLATES.getComponentSLD(layerType, layerName, layerComponent, componentSymbology);
			layerList[layerCode]['layer'][layerComponent]['layerSource'] = new ol.source.ImageWMS({
                url: 'https://geoserver.hydroshare.org/geoserver/wms',
                params: {'LAYERS': layerName, 'SLD_BODY': sldBody},
                serverType: 'geoserver',
                crossOrigin: 'Anonymous'
            });
			var componentSymbologyFunction = symbologyGetFunction(layerList[layerCode]['layer'][layerComponent]['symbology']['type']);
			layerList[layerCode]['layer'][layerComponent]['rasterSource'] = new ol.source.Raster({
                sources: [layerList[layerCode]['layer'][layerComponent]['layerSource']],
                operation: function(pixels, data) {
                    pixel = symbologyFunction(pixels, data);
                    return pixel
                },
                lib: {
                    symbologyFunction: componentSymbologyFunction
                }
            });
            layerList[layerCode]['layer'][layerComponent]['rasterSource'].layerComponent = layerComponent;
            layerList[layerCode]['layer'][layerComponent]['rasterSource'].layerCode = layerCode;
            layerList[layerCode]['layer'][layerComponent]['rasterSource'].on('beforeoperations', function(event) {
                var data = event.data;
                if (layerList[event.target.layerCode]['layer'][event.target.layerComponent]['symbology']['type'] === 'simple') {
                    data['color'] = layerList[event.target.layerCode]['layer'][event.target.layerComponent]['symbology']['color'];
                };
                if (layerList[event.target.layerCode]['layer'][event.target.layerComponent]['symbology']['type'] === 'colorMapCont') {
                    data['colorMap'] = symbologyGetColorMap(layerList[event.target.layerCode]['layer'][event.target.layerComponent]['symbology']['colorMap']);
                };
            });
            layerList[layerCode]['layer'][layerComponent]['imageSource'] = new ol.layer.Image({
                source: layerList[layerCode]['layer'][layerComponent]['rasterSource']
            });
            map.addLayer(layerList[layerCode]['layer'][layerComponent]['imageSource']);
    	};
    };

    /* Add WFS Layer to map */
    function addWFSLayer(layerCode) {
    	var layerExtent = layerList[layerCode]['layerExtent'];
    	var layerName = layerList[layerCode]['layerName'];
	    layerList[layerCode]['layer']['point']['layerSource'] = new ol.source.Vector({
	        format: new ol.format.GeoJSON(),
	        url: function(extent) {
	          	return 'https://geoserver.hydroshare.org/geoserver/wfs?service=WFS&' +
	              	'version=1.1.0&request=GetFeature&typename=' + layerName + '&' +
	              	'outputFormat=application/json&srsname=EPSG:3857&' +
	              	'bbox=' + layerExtent.join(',') + ',EPSG:3857';
	        },
	        strategy: ol.loadingstrategy.bbox
	    });
	    layerList[layerCode]['layer']['point']['imageSource'] = new ol.layer.Vector({
	    	renderMode: 'image',
        	source: layerList[layerCode]['layer']['point']['layerSource'],
        	style: getPointStyle(layerCode)
        });
        map.addLayer(layerList[layerCode]['layer']['point']['imageSource']);
    };

    /* Creates an OpenLayers point style object */
    function getPointStyle(layerCode) {
    	var pointShape = layerList[layerCode]['layer']['point']['symbology']['fill']['shape'];
    	switch (pointShape) {
    		case 'circle':
    		    console.log(layerList[layerCode]['layer']['point']['symbology'])
    		    var pointStyle = new ol.style.Style({
    		    	image: new ol.style.Circle({
			            radius: layerList[layerCode]['layer']['point']['symbology']['fill']['size'],
			            fill: new ol.style.Fill({
			            	color: layerList[layerCode]['layer']['point']['symbology']['fill']['color']
			            }),
			            stroke: new ol.style.Stroke({
			                color: layerList[layerCode]['layer']['point']['symbology']['stroke']['color'], 
			                width: layerList[layerCode]['layer']['point']['symbology']['stroke']['size']
			            })
			        })
			    })
    		    break;
    		case 'square':
    		    var pointStyle = new ol.style.Style({
    		    	image: new ol.style.RegularShape({
			            radius: layerList[layerCode]['layer']['point']['symbology']['fill']['size'] * 1.5,
			            fill: new ol.style.Fill({
			            	color: layerList[layerCode]['layer']['point']['symbology']['fill']['color']
			            }),
			            stroke: new ol.style.Stroke({
			                color: layerList[layerCode]['layer']['point']['symbology']['stroke']['color'], 
			                width: layerList[layerCode]['layer']['point']['symbology']['stroke']['size']
			            }),
			            points: 4,
			            angle: Math.PI / 4
			        })
			    })
    		    break;
    		case 'triangle':
    		    var pointStyle = new ol.style.Style({
    		    	image: new ol.style.RegularShape({
			            radius: layerList[layerCode]['layer']['point']['symbology']['fill']['size'] * 1.5,
			            fill: new ol.style.Fill({
			            	color: layerList[layerCode]['layer']['point']['symbology']['fill']['color']
			            }),
			            stroke: new ol.style.Stroke({
			                color: layerList[layerCode]['layer']['point']['symbology']['stroke']['color'], 
			                width: layerList[layerCode]['layer']['point']['symbology']['stroke']['size']
			            }),
			            points: 3,
			            rotation: 0,
			            angle: 0
			        })
			    })
    			break;
    		default:
    			var pointStyle = '';
    			break;
    	};
    	return pointStyle;
    };

    /* Creates a unique layer code for a map layer */
    function createLayerCode() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        };
        return 'L-' + s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    };

    /* Gets colormap for rasters and attribute styling */
    function symbologyGetColorMap(colorMapName) {
        var colorMaps = {
            rainbow: {
                colors: [[150, 0, 90], [0, 0, 200], [0, 25, 255], [0, 152, 255], [44, 255, 150], [151, 255, 0], [255, 234, 0], [255, 111, 0], [255, 0, 0]],
                positions: [0, .125, .25, .375, .5, .625, .75, .875, 1]
            },
            viridis: {
                colors: [[68,1,84], [71,44,122], [59,81,139], [44,113,142], [33,144,141], [39,173,129], [92,200,99], [170,220,50], [253,231,37]],
                positions: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
            },
            jet: {
                colors: [[0,0,131], [0,60,170], [5,255,255], [255,255,0], [250,0,0], [128,0,0]],
                positions: [0, 0.125, 0.375, 0.625, 0.875, 1]
            },
            hot: {
                colors: [[0,0,0], [230,0,0], [255,210,0], [255,255,255]],
                positions: [0, 0.333, 0.666, 1]
            },
            cool: {
                colors: [[0,255,255], [255,0,255]],
                positions: [0, 1]
            },
            magma: {
                colors: [[0,0,4], [28,16,68], [79,18,123], [129,37,129], [181,54,122], [229,80,100], [251,135,97], [254,194,135], [252,253,191]],
                positions: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
            },
            plasma: {
                colors: [[13,8,135], [75,3,161], [125,3,168], [168,34,150], [203,70,121], [229,107,93], [248,148,65], [253,195,40], [240,249,33]],
                positions: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
            },
            spring: {
                colors: [[255, 0, 255], [255, 255, 0]],
                positions: [0, 1]
            },
            electric: {
                colors: [[0, 0, 0], [30, 0, 100], [120, 0, 100], [160, 90, 0], [230, 200, 0], [255, 250, 220]],
                positions: [0, .15, .4, .6, .8, 1]
            },
            blackbody: {
                colors: [[0, 0, 0], [230, 0, 0], [230, 210, 0], [255, 255, 255], [160, 200, 255]],
                positions: [0, .2, .4, .7, 1]
            },
            summer: {
                colors: [[0, 128, 102], [255, 255, 102]],
                positions: [0, 1]
            },
            autumn: {
                colors: [[255, 0, 0], [255, 255, 0]],
                positions: [0, 1]
            },
            winter: {
                colors: [[0, 0, 255], [0, 255, 128]],
                positions: [0, 1]
            },
            bone: {
                colors: [[0, 0, 0], [84, 84, 116], [169, 200, 200], [255, 255, 255]],
                positions: [0, .376, .753, 1]
            },
            gray: {
                colors: [[0, 0, 0], [255, 255, 255]],
                positions: [0, 1]
            },
        };
        var colorMap = colorMaps[colorMapName]
        return colorMap;
    };

    /* Gets symbology function for layer */
    function symbologyGetFunction(symbologyFunctionName) {
        var symbologyFunctions = {
            colorMapCont: function(pixels, data) {
                var pixel = pixels[0];
                var value = pixel[1] / 255;
                var colormap = data['colorMap'];
                var inRange = function(e) {
                    return e >= value;
                };
                var colorIndex = colormap['positions'].findIndex(inRange);
                if (colorIndex === 0) {
                    colorIndex = 1;
                };
                var position1 = colormap['positions'][colorIndex - 1];
                var position2 = colormap['positions'][colorIndex];
                var factor = (value - position1) / (position2 - position1);
                var color1 = colormap['colors'][colorIndex - 1];
                var color2 = colormap['colors'][colorIndex];
                var mappedColor = color1.slice();
                for (var i=0;i<3;i++) {
                    mappedColor[i] = Math.round(mappedColor[i] + factor*(color2[i]-color1[i]));
                };
                pixel[0] = mappedColor[0];
                pixel[1] = mappedColor[1];
                pixel[2] = mappedColor[2];
                return pixel;
            },
            simple: function(pixels, data) {
                pixel = pixels[0];
                color = data['color'];
                pixel[0] = color[0];
                pixel[1] = color[1];
                pixel[2] = color[2];
                return pixel;
            },
            colorMapInt: function(pixels, data) {
                pixel = pixels[0];
                return pixel;
            },
            threshold: function(pixels, data) {
                var pixel = pixels[0];
                var value = pixel[1] / 255;
                var thresholdColor = data['thresholdColor'];
                var invert = data['thresholdInvert'];
                var maxValue = data['maxValue'];
                var minValue = data['minValue'];
                var upperThreshold = (data['upperThreshold'] - minValue) / maxValue;
                var lowerThreshold = (data['lowerThreshold'] - minValue) / maxValue;
                if (invert = false) {
                    if (value <= upperThreshold && value >= lowerThreshold) {
                        pixel[0] = thresholdColor[0];
                        pixel[1] = thresholdColor[1];
                        pixel[2] = thresholdColor[2];
                    } else {
                        pixel[3] = 0;
                    };
                } else {
                    if (value >= upperThreshold || value <= lowerThreshold) {
                        pixel[0] = thresholdColor[0];
                        pixel[1] = thresholdColor[1];
                        pixel[2] = thresholdColor[2];
                    } else {
                        pixel[3] = 0;
                    };
                };
            }
        };
        var symbologyFunction = symbologyFunctions[symbologyFunctionName];
        return symbologyFunction;
    };

    /* Initializes color picker for layer symbology */
    function symbologyColorPicker(element, defaultColor) {
        $(element).spectrum({
            color: {'r': defaultColor[0],'g': defaultColor[1],'b': defaultColor[2]},
            showPaletteOnly: true,
            togglePaletteOnly: true,
            togglePaletteMoreText: 'more',
            togglePaletteLessText: 'less',
            showButtons: false,
            palette: [
                ["#000","#444","#666","#999","#ccc","#eee","#f3f3f3","#fff"],
                ["#f00","#f90","#ff0","#0f0","#0ff","#00f","#90f","#f0f"],
                ["#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#cfe2f3","#d9d2e9","#ead1dc"],
                ["#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#9fc5e8","#b4a7d6","#d5a6bd"],
                ["#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6fa8dc","#8e7cc3","#c27ba0"],
                ["#c00","#e69138","#f1c232","#6aa84f","#45818e","#3d85c6","#674ea7","#a64d79"],
                ["#900","#b45f06","#bf9000","#38761d","#134f5c","#0b5394","#351c75","#741b47"],
                ["#600","#783f04","#7f6000","#274e13","#0c343d","#073763","#20124d", '#20124e']
            ],
            showButtons: true,
            showAlpha: true,
            move: function (color) {
                var layerCode = activeLayer;
                var layerType = layerList[layerCode]['layerType'];
                var layerComponent = $(this).attr('comp');
                var rgbColor = color.toRgb()
                var colorOutput = [rgbColor['r'],rgbColor['g'],rgbColor['b']]
                var opacity = rgbColor['a']
                if (layerType === 'polygon' || layerType === 'line' || layerType === 'raster') {
	                layerList[layerCode]['layer'][layerComponent]['symbology']['color'] = colorOutput; 
	                layerList[layerCode]['layer'][layerComponent]['rasterSource'].changed();
	                layerList[layerCode]['layer'][layerComponent]['imageSource'].setOpacity(opacity);
                };
                if (layerType === 'point' || layerType === 'timeseries') {
	                layerList[layerCode]['layer']['point']['symbology'][layerComponent]['color'] = colorOutput; 
	                layerList[layerCode]['layer']['point']['imageSource'].setStyle(getPointStyle(layerCode));
	                layerList[layerCode]['layer']['point']['imageSource'].setOpacity(opacity);
                };
                updateLayerIcon(layerCode);
            }
        });
    };

    /* Refreshes layer display order based on layer list */
    function reorderMapLayers() {
    	setTimeout(() => {
			layerTable.rows().every(function(){
				var tableRow = this.data();
				var layerCode = tableRow[1];
				for (var layerComponent in layerList[layerCode]['layer']) {
					if (layerComponent === 'basemap') {
					    layerList[layerCode]['layer'][layerComponent]['satellite'].setZIndex(1000 - tableRow[0] * 3 - layerList[layerCode]['layer'][layerComponent]['zIndex'])
					    layerList[layerCode]['layer'][layerComponent]['street'].setZIndex(1000 - tableRow[0] * 3 - layerList[layerCode]['layer'][layerComponent]['zIndex'])
					    layerList[layerCode]['layer'][layerComponent]['grey'].setZIndex(1000 - tableRow[0] * 3 - layerList[layerCode]['layer'][layerComponent]['zIndex'])
					    layerList[layerCode]['layer'][layerComponent]['dark'].setZIndex(1000 - tableRow[0] * 3 - layerList[layerCode]['layer'][layerComponent]['zIndex'])
					} else {
					    layerList[layerCode]['layer'][layerComponent]['imageSource'].setZIndex(1000 - tableRow[0] * 3 - layerList[layerCode]['layer'][layerComponent]['zIndex'])
					}
				};
			});
		}, 100);
    };

    /* Zooms to layer extent */
    function zoomToLayer() {
    	var layerCode = activeLayer;
    	zoomToExtent([layerCode]);
    };

    /* Zooms to extent of layer group */
    function zoomToExtent(layerCodeList) {
		var extent = ol.extent.createEmpty();
		for (var i = 0; i < layerCodeList.length; i++) {
			ol.extent.extend(extent, layerList[layerCodeList[i]]['layerExtent']);
		};
		map.getView().fit(extent, map.getSize());
    };

    /* Updates the map size when the window is resized */
    function updateMapSize() {
        var timeout = 150;
        setTimeout(function() {map.updateSize();}, timeout);
    };

    /* Changes the data viewer tab */
    function changeDataViewerTab() {
        $('.data-viewer-tabs > li').removeClass('active');
        $(this).addClass('active');
        $('.data-viewer-content-page').addClass('hidden');
        console.log($(this).attr('id'))
        $(`#${$(this).attr('id')}-view`).removeClass('hidden');
    };

    /* Shows the data viewer window */
    function showDataViewer() {
        $('.data-viewer-content').removeClass('hidden');
        $('#data-viewer-show').addClass('hidden');
        $('#data-viewer-hide').removeClass('hidden');
        $('.data-viewer-tabs').removeClass('hidden');
        updateMapSize();
    };

    /* Hides the data viewer window */
    function hideDataViewer() {
        $('.data-viewer-content').addClass('hidden');
        $('#data-viewer-show').removeClass('hidden');
        $('#data-viewer-hide').addClass('hidden');
        $('.data-viewer-tabs').addClass('hidden');
        updateMapSize();
    };

    /* Updates data viewer for currently selected layer */
    function updateDataViewer(e, dt, type, indexes) {

    	// Set the active layer
    	var layerCode = layerTable.rows(indexes).data().toArray()[0][1]
    	var layerType = layerList[layerCode]['layerType'];
    	activeLayer = layerCode;

    	// Reset the active tab
    	$('.data-viewer-tab').removeClass('active');
    	$('#layer-options-tab').addClass('active');
    	$('.data-viewer-content-page').addClass('hidden');
    	$('#layer-options-tab-view').removeClass('hidden');

    	// Displays relevent styling options
    	$('.symbology-input-container').addClass('hidden');
    	$('#layer-name-container').removeClass('hidden');
    	$('#layer-name-input').val(layerList[activeLayer]['displayName']);
    	$('.action-btn').addClass('hidden');
    	$('.data-viewer-tab').addClass('hidden');
    	$('#layer-options-tab').removeClass('hidden');

    	if (layerList[layerCode]['layerVisible'] === true) {
    		$('#hide-layer-btn').removeClass('hidden');
    	} else {
    		$('#show-layer-btn').removeClass('hidden');
    	};

    	switch(layerType) {
    		case 'point':
    			$('#zoom-to-layer-btn').removeClass('hidden');
    			$('#remove-layer-btn').removeClass('hidden');
    			$('#attr-table-tab').removeClass('hidden');
    			$('#fill-color-container').removeClass('hidden');
    			$('#line-color-container').removeClass('hidden');
    			$('#line-size-container').removeClass('hidden');
    			$('#point-size-container').removeClass('hidden');
    			$('#point-shape-container').removeClass('hidden');
                symbologyColorPicker('#fill-color-selector', layerList[layerCode]['layer']['point']['symbology']['fill']['color']);
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layer']['point']['symbology']['stroke']['color']);

    			break;
    		case 'line':
    			$('#zoom-to-layer-btn').removeClass('hidden');
    			$('#remove-layer-btn').removeClass('hidden');
    			$('#attr-table-tab').removeClass('hidden');
    			$('#line-color-container').removeClass('hidden');
    			$('#line-size-container').removeClass('hidden');
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layer']['stroke']['symbology']['color']);

    		    break;
    		case 'polygon':
    			$('#zoom-to-layer-btn').removeClass('hidden');
    			$('#remove-layer-btn').removeClass('hidden');
    			$('#attr-table-tab').removeClass('hidden');
    			$('#fill-color-container').removeClass('hidden');
    			$('#line-color-container').removeClass('hidden');
    			$('#line-size-container').removeClass('hidden');
                symbologyColorPicker('#fill-color-selector', layerList[layerCode]['layer']['fill']['symbology']['color']);
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layer']['stroke']['symbology']['color']);

    		    break;
    		case 'raster':
    			$('#zoom-to-layer-btn').removeClass('hidden');
    			$('#remove-layer-btn').removeClass('hidden');
    			$('#color-map-container').removeClass('hidden');
                
    		    break;
    		case 'basemap':
    			$('#basemap-container').removeClass('hidden');
    			$('#basemap-select').val(layerList[activeLayer]['layer']['basemap']['symbology']);
    		    break;
    	};

    	// Show the data viewer
		showDataViewer();
    };

    /* Disables data viewer when no layers are selected */
    function disableDataViewer(e, dt, type, indexes) {
    	hideDataViewer();
    	activeLayer = null;
    	$('#data-viewer-show').addClass('hidden');
    };

    /* Changes Basemap */
    function changeBasemap(evt) {
    	layerList['L-00000000-0000-0000-0000-000000000000']['layer']['basemap']['symbology'] = $(this).val();
    	layerList['L-00000000-0000-0000-0000-000000000000']['layer']['basemap']['satellite'].setVisible(false);
    	layerList['L-00000000-0000-0000-0000-000000000000']['layer']['basemap']['street'].setVisible(false);
    	layerList['L-00000000-0000-0000-0000-000000000000']['layer']['basemap']['grey'].setVisible(false);
    	layerList['L-00000000-0000-0000-0000-000000000000']['layer']['basemap']['dark'].setVisible(false);
    	layerList['L-00000000-0000-0000-0000-000000000000']['layer']['basemap'][$(this).val()].setVisible(true);
    };

    /* Changes Layer Display Name */
    function changeLayerDisplayName(evt) {
    	layerList[activeLayer]['displayName'] = $('#layer-name-input').val();
		layerTable.rows().every(function(){
			var tableRow = this.data();
			var layerCode = tableRow[1];
			if (layerCode === activeLayer) {
				console.log($('.layer-display-name').val())
				layerTable.cell(this[0][0], 3).data(layerList[activeLayer]['displayName'])
			};
		});
    };

    /* Changes Layer Symbology */
    function updateLayerSymbology(evt) {
    	switch ($(this).attr('id')) {
    		case 'point-shape-input':
    		    layerList[activeLayer]['layer']['point']['symbology']['fill']['shape'] = $(this).val();
	            layerList[activeLayer]['layer']['point']['imageSource'].setStyle(getPointStyle(activeLayer));
    			break;
    		case 'point-size-input':
    			layerList[activeLayer]['layer']['point']['symbology']['fill']['size'] = $(this).val();
	            layerList[activeLayer]['layer']['point']['imageSource'].setStyle(getPointStyle(activeLayer));
	            break;
	        case 'line-size-input':
	        	switch (layerList[activeLayer]['layerType']) {
	        		case 'point':
	        		    layerList[activeLayer]['layer']['point']['symbology']['stroke']['size'] = $(this).val();
			            layerList[activeLayer]['layer']['point']['imageSource'].setStyle(getPointStyle(activeLayer));
	        			break;
	        		case 'line':
	        		    layerList[activeLayer]['layer']['stroke']['symbology']['size'] = $(this).val();
				    	var layerName = layerList[activeLayer]['layerName'];
				    	var layerType = 'line';
						var componentSymbology = layerList[activeLayer]['layer']['stroke']['symbology'];
        				var sldBody = SLD_TEMPLATES.getComponentSLD(layerType, layerName, 'stroke', componentSymbology);
	        		    layerList[activeLayer]['layer']['stroke']['layerSource'].updateParams({'SLD_BODY': sldBody});
	        		    layerList[activeLayer]['layer']['stroke']['rasterSource'].changed();
	        			break;
	        	    case 'polygon':
	        		    layerList[activeLayer]['layer']['stroke']['symbology']['size'] = $(this).val();
				    	var layerName = layerList[activeLayer]['layerName'];
				    	var layerType = 'polygon';
						var componentSymbology = layerList[activeLayer]['layer']['stroke']['symbology'];
        				var sldBody = SLD_TEMPLATES.getComponentSLD(layerType, layerName, 'stroke', componentSymbology);
	        		    layerList[activeLayer]['layer']['stroke']['layerSource'].updateParams({'SLD_BODY': sldBody});
	        		    layerList[activeLayer]['layer']['stroke']['rasterSource'].changed();
	        		    console.log('done')
	        	        break;
	        	};
	        	break;
	        case 'color-map-input':
	            switch (layerList[activeLayer]['layerType']) {
	            	case 'raster':
	            		layerList[activeLayer]['layer']['raster']['symbology']['colorMap'] = $(this).val();
	            		layerList[activeLayer]['layer']['raster']['rasterSource'].changed();
	            		break;
	            };
	            break;
	        	layerList[activeLayer]
    	};
    	updateLayerIcon(activeLayer);
    };

    /* Updates Layer Visibility */
    function toggleLayer(evt) {
    	var layerVisible = layerList[activeLayer]['layerVisible'];
    	if (layerVisible === true) {
    		layerList[activeLayer]['layerVisible'] = false;
    		$('#show-layer-btn').removeClass('hidden');
    		$('#hide-layer-btn').addClass('hidden');
    	} else {
    		layerList[activeLayer]['layerVisible'] = true;
    		$('#show-layer-btn').addClass('hidden');
    		$('#hide-layer-btn').removeClass('hidden');
    	};
    	for (var layerComponent in layerList[activeLayer]['layer']) {
    		if (layerComponent === 'basemap') {
    			console.log(layerList[activeLayer]['layer'][layerComponent]['symbology'])
    			layerList[activeLayer]['layer'][layerComponent][layerList[activeLayer]['layer'][layerComponent]['symbology']].setVisible(layerList[activeLayer]['layerVisible']);
    			if (layerList[activeLayer]['layerVisible'] === true) {
    				$('#map').css('background-color', 'lightgrey');
    			} else {
    				$('#map').css('background-color', 'white');
    			};
    		} else {
            	layerList[activeLayer]['layer'][layerComponent]['imageSource'].setVisible(layerList[activeLayer]['layerVisible']);
    		};
    	};
    };

    /* Removes a Layer from the Session */
    function removeLayer(evt) {
    	layerTable.row('.selected').remove().draw(false);
    	for (var layerComponent in layerList[activeLayer]['layer']) {
    		map.removeLayer(layerList[activeLayer]['layer'][layerComponent]['imageSource']);
    	};
    	delete layerList[activeLayer];
    	activeLayer = null;
    	disableDataViewer();
    };

    /* Updates Layer Icon when Symbology Changes */
    function updateLayerIcon(layerCode) {
    	var layerIcon = createLayerIcon(layerCode);
        layerTable.rows().every(function(){
			var tableRow = this.data();
			var tableLayerCode = tableRow[1];
			if (tableLayerCode === layerCode) {
				layerTable.cell(this[0][0], 2).data(layerIcon);
			};
		});
    };

    /* Creates SVG Icon for Layer */
    function createLayerIcon(layerCode) {
        var layerType = layerList[layerCode]['layerType'];
        switch (layerType) {
        	case 'point':
        	    var pointShape = layerList[layerCode]['layer']['point']['symbology']['fill']['shape'];
        		var fillColor = layerList[layerCode]['layer']['point']['symbology']['fill']['color'];
        		var lineColor = layerList[layerCode]['layer']['point']['symbology']['stroke']['color'];
        		switch (pointShape) {
        			case 'circle':
        			    var layerIcon = `
		                    <svg height="24" width="24">
		                        <circle class="layer-icon" cx="12" cy="12" r="7" style="fill:rgb(${fillColor[0]},${fillColor[1]},${fillColor[2]});stroke:rgb(${lineColor[0]},${lineColor[1]},${lineColor[2]});stroke-width:2" />
		                    </svg>
		                `;
        			    break;
        			case 'square':
        			    var layerIcon = `
		                    <svg height="24" width="24">
		                        <rect class="layer-icon" x="5" y="5" width="14" height="14" style="fill:rgb(${fillColor[0]},${fillColor[1]},${fillColor[2]});stroke:rgb(${lineColor[0]},${lineColor[1]},${lineColor[2]});stroke-width:2" />
		                    </svg>
		                `;
        			    break;
        			case 'triangle':
        				var layerIcon = `
        					<svg height="24" width="24">
        						<polygon class="layer-icon" points="2 22, 22 22, 12 6" style="fill:rgb(${fillColor[0]},${fillColor[1]},${fillColor[2]});stroke:rgb(${lineColor[0]},${lineColor[1]},${lineColor[2]});stroke-width:2"/>
        					</svg>
        				`;
        			    break;
        		};
        		break;
        	case 'line':
        	    var lineColor = layerList[layerCode]['layer']['stroke']['symbology']['color'];
        	    var layerIcon = `
	                <svg height="24" width="24">
	                  <polyline class="layer-icon" points="1,23 20,18 5,7 23,1" style="fill:none;stroke:rgb(${lineColor[0]},${lineColor[1]},${lineColor[2]});stroke-width:2" />
	                </svg>
	            `;
        		break;
        	case 'polygon':
        	    var fillColor = layerList[layerCode]['layer']['fill']['symbology']['color'];
        	    var lineColor = layerList[layerCode]['layer']['stroke']['symbology']['color'];
        	    var layerIcon = `
	                <svg height="24" width="24">
	                  <polygon class="layer-icon" points="1,23 5,5 20,1 23,20" style="fill:rgb(${fillColor[0]},${fillColor[1]},${fillColor[2]});stroke:rgb(${lineColor[0]},${lineColor[1]},${lineColor[2]});stroke-width:2" />
	                </svg>
	            `;
        		break;
        	case 'raster':
        	    var colorMapName = layerList[layerCode]['layer']['raster']['symbology']['colorMap'];
        	    var colorMap = symbologyGetColorMap(colorMapName);
        	    var svgGradient = ``
	            for (var i = 0; i < colorMap['colors'].length; i++) { 
	                svgGradient = svgGradient + `<stop offset="${(colorMap['positions'][i] * 100).toString()}%" style="stop-color:rgb(${colorMap['colors'][i][0]},${colorMap['colors'][i][1]},${colorMap['colors'][i][2]});stop-opacity:1" />`
	            };
        	    var layerIcon = `
	                <svg height="24" width="24">
	                  <defs>
	                    <linearGradient id="${'grad-' + layerCode}" x1="0%" y1="0%" x2="100%" y2="0%">
	                      ${svgGradient}
	                    </linearGradient>
	                  </defs>
	                  <rect class="layer-icon" width="24" height="24" fill="url(#${'grad-' + layerCode})" />
	                </svg>
	            `;
        		break;
        };
        return layerIcon
    };

    /*****************************************************************************************
     ************************************** LISTENERS ****************************************
     *****************************************************************************************/

    /* Listener for updating map size on nav toggle */
    $(document).on('click', '.toggle-nav', updateMapSize);

    /* Listener for changing data viewer tabs */
    $(document).on('click', '.data-viewer-tabs > li', changeDataViewerTab);

    /* Listener for collapsing data viewer */
    $(document).on('click', '#data-viewer-show', showDataViewer);

    /* Listener for collapsing data viewer */
    $(document).on('click', '#data-viewer-hide', hideDataViewer);

    /* Listener for zooming to layer */
    $(document).on('click', '#zoom-to-layer-btn', zoomToLayer);

    /* Listener for changing basemap */
    $(document).on('change', '#basemap-select', changeBasemap);

    /* Listener for changing layer display name */
    $(document).on('keyup', '#layer-name-input', changeLayerDisplayName);

    /* Listener for changing point shape */
    $(document).on('change', '.symbology-input', updateLayerSymbology);

    /* Listener for hiding layer */
    $(document).on('click', '#hide-layer-btn', toggleLayer);

    /* Listener for showing layer */
    $(document).on('click', '#show-layer-btn', toggleLayer);

    /* Listener for removing layer */
    $(document).on('click', '#remove-layer-confirm-btn', removeLayer);

    /*****************************************************************************************
     ************************************ INIT FUNCTIONS *************************************
     *****************************************************************************************/

    initApp();

}());