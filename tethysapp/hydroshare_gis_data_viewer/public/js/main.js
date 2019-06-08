(function packageHydroShareHISDataViewer() {

    'use strict';

    /*****************************************************************************************
     *********************************** GLOBAL VARIABLES ************************************
     *****************************************************************************************/

    var map;
    var mapBasemaps;
    var layerTable;
    var attributeTable;
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
            view: new ol.View({
                center: ol.proj.transform([0, 0], 'EPSG:4326', 'EPSG:3857'),
                zoom: 1.8,
                minZoom: 1.8,
                maxZoom: 19
            })
        });

        // Adds a scale line and full screen control to the map.
        map.addControl(new ol.control.ScaleLine());
        map.addControl(new ol.control.FullScreen());

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
        var layerCode = '0000000000'
        layerList[layerCode] = {
        	'layerName': 'Background Map',
        	'layerType': 'basemap',
            'layerVisible': true,
            'layerSource': {
                'satellite': satLayer,
                'street': streetLayer,
                'grey': greyLayer,
                'dark': darkLayer
            },
            'layerSymbology': {
                'visible': true,
                'type': 'satellite',
                'zIndex': 0
            }
        };

        var rowNode = layerTable.row.add([
        	1,
            '0000000000',
            `<img src="/static/hydroshare_gis_data_viewer/images/basemap.svg"/>`,
            layerList[layerCode]['layerName'],
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('layer-icon');
        $(rowNode).find('td').eq(1).addClass('layer-name');
        $(rowNode).find('td').eq(2).addClass('layer-move');

        // Adds HydroShare resource layers to map.
        getHydroShareResourceLayers(resList);
    };

    /* Gets available layers from HydroShare resource */
    function getHydroShareResourceLayers(resIdList) {
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            data: {
                'resource_id_list': resIdList
            },
            url: 'get-hydroshare-resource-layers/',
            success: function(response) {
                if (response['success'] === true) {
                    for (var layerCode in response['results']) {
                        addLayerToMap(layerCode, response['results'][layerCode])
                    };
                    zoomToExtent(response['results']);
                } else {
                    console.log('Layer Load Failed')
                };
            },
            error: function(response) {
                console.log('Layer Load Failed')
            }
        });
    };

    /* Adds a layer to the map */
    function addLayerToMap(layerCode, layer) {

        layerList[layerCode] = layer;
        layerList[layerCode]['layerSymbology'] = getLayerSymbology(layerCode)
        var sldBody = SLD_TEMPLATES.getLayerSLD(layerList[layerCode]['layerType'], layerList[layerCode]['layerId'], layerList[layerCode]['layerSymbology'])

        layerList[layerCode]['layerWMS'] = new ol.source.ImageWMS({
            url: 'https://geoserver.hydroshare.org/geoserver/wms',
            params: {'LAYERS': layerList[layerCode]['layerId'], 'SLD_BODY': sldBody},
            serverType: 'geoserver',
            crossOrigin: 'Anonymous'
        });

        layerList[layerCode]['layerSource'] = new ol.layer.Image({
            source: layerList[layerCode]['layerWMS']
        });

        map.addLayer(layerList[layerCode]['layerSource']);

        layerList[layerCode]['layerVisible'] = true;

        layerTable.rows().eq(0).each(function(index) {
        	var cell = layerTable.cell(index, 0);
		    cell.data(parseInt(cell.data(), 10) + 1).draw();
		});

        var rowNode = layerTable.row.add([
        	1,
            layerCode,
            createLayerIcon(layerCode),
            layer['layerName'],
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('layer-icon');
        $(rowNode).find('td').eq(1).addClass('layer-name');
        $(rowNode).find('td').eq(2).addClass('layer-move');

        reorderMapLayers();

        return layerCode;
    };

    /* Gets Default Symbology for a Layer */
    function getLayerSymbology(layerCode) {
        var initialColors = [
            "#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#cfe2f3","#d9d2e9","#ead1dc",
            "#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#9fc5e8","#b4a7d6","#d5a6bd",
            "#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6fa8dc","#8e7cc3","#c27ba0",
            "#c00","#e69138","#f1c232","#6aa84f","#45818e","#3d85c6","#674ea7","#a64d79"
        ];
        switch(layerList[layerCode]['layerType']) {
            case 'point':
                var layerSymbology = {
                    'type': 'simple',
                    'shape': 'circle',
                    'fillColor': initialColors[Math.floor(Math.random() * 31)],
                    'fillOpacity': 1,
                    'strokeColor': '#000000',
                    'strokeOpacity': 1,
                    'strokeWidth': 1,
                    'size': 6
                };
                break;
            case 'line': 
                var layerSymbology = {
                    'type': 'simple',
                    'strokeColor': initialColors[Math.floor(Math.random() * 31)],
                    'strokeOpacity': 1,
                    'strokeWidth': 1
                };
                break;
            case 'polygon':
                var layerSymbology = {
                    'type': 'simple',
                    'fillColor': initialColors[Math.floor(Math.random() * 31)],
                    'fillOpacity': 1,
                    'strokeColor': '#000000',
                    'strokeOpacity': 1,
                    'strokeWidth': 1,
                };
                break;
            case 'raster':
                var colorMap = getColorMap('gray', layerList[layerCode]['layerProperties'][0]['max_value'], layerList[layerCode]['layerProperties'][0]['min_value'])
                var layerSymbology = {
                    'type': 'colormap',
                    'colormap': colorMap,
                };
                break;
        };
        return layerSymbology
    };

    /* Gets colormap for raster and attribute styling */
    function getColorMap(colorMap, maxValue, minValue) {
        var colorMaps = {
            'gray': {
                'colors': ['#000000', '#FFFFFF'],
                'positions': [0, 1]
            },
            'rainbow': {
                'colors': ['#96005A', '#0000C8', '#0019FF', '#0098FF', '#2CFF96', '#97FF00', '#FFEA00', '#FF6F00', '#FF0000'],
                'positions': [0, .125, .25, .375, .5, .625, .75, .875, 1]
            },
            'viridis': {
                'colors': ['#4401FF', '#472C7A', '#3B518B', '#2C718E', '#21908D', '#27AD81', '#5CC863', '#AADC32', '#FDE725'],
                'positions': [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
            },
            'jet': {
                'colors': ['#000083', '#003CAA', '#05FFFF', '#FFFF00', '#FF0000', '#800000'],
                'positions': [0, 0.125, 0.375, 0.625, 0.875, 1]
            },
            'hot': {
                'colors': ['#000000', '#E60000', '#FFD200', '#FFFFFF'],
                'positions': [0, 0.333, 0.666, 1]
            },
            'cool': {
                'colors': ['#00FFFF', '#FF00FF'],
                'positions': [0, 1]
            },
            'magma': {
                'colors': ['#000004', '#1C1044', '#4F127B', '#812581', '#B5367A', '#E55064', '#FB8761', '#FEC287', '#FCFDBF'],
                'positions': [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
            },
            'plasma': {
                'colors': ['#0D0887', '#4B03A1', '#7D03A8', '#A82296', '#CB4679', '#E56B5D', '#F89441', '#FDC328', '#F0F921'],
                'positions': [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
            },
            'spring': {
                'colors': ['#FF00FF', '#FFFF00'],
                'positions': [0, 1]
            },
            'electric': {
                'colors': ['#000000', '#1E0064', '#780064', '#A05A00', '#E6C800', '#FFFADC'],
                'positions': [0, .15, .4, .6, .8, 1]
            },
            'blackbody': {
                'colors': ['#000000', '#E60000', '#E6D200', '#FFFFFF', '#A0C8FF'],
                'positions': [0, .2, .4, .7, 1]
            },
            'summer': {
                'colors': ['#008066', '#FFFF66'],
                'positions': [0, 1]
            },
            'autumn': {
                'colors': ['#FF0000', '#FFFF00'],
                'positions': [0, 1]
            },
            'winter': {
                'colors': ['#0000FF', '#00FF80'],
                'positions': [0, 1]
            },
            'bone': {
                'colors': ['#000000', '#545474', '#A9C8C8', '#FFFFFF'],
                'positions': [0, .376, .753, 1]
            }
        };
        var positions = [];
        for (var i = 0; i < colorMaps[colorMap]['positions'].length; i++) {
            positions.push(minValue + colorMaps[colorMap]['positions'][i] * (maxValue - minValue))
        };
        return {
            'colors': colorMaps[colorMap]['colors'],
            'positions': positions
        };
    };

    /* Refreshes layer display order based on layer list */
    function reorderMapLayers() {
        setTimeout(() => {
            layerTable.rows().every(function(){
                var tableRow = this.data();
                var layerCode = tableRow[1];
                if (layerList[layerCode]['layerType'] === 'basemap') {
                    layerList[layerCode]['layerSource']['satellite'].setZIndex(1000 - tableRow[0])
                    layerList[layerCode]['layerSource']['street'].setZIndex(1000 - tableRow[0])
                    layerList[layerCode]['layerSource']['grey'].setZIndex(1000 - tableRow[0])
                    layerList[layerCode]['layerSource']['dark'].setZIndex(1000 - tableRow[0])
                } else {
                    layerList[layerCode]['layerSource'].setZIndex(1000 - tableRow[0])
                };
            });
        }, 100);
    };

    /* Updates the map size when the window is resized */
    function updateMapSize() {
        var timeout = 150;
        setTimeout(function() {map.updateSize();}, timeout);
    };

    /* Zooms to extent of layer group */
    function zoomToExtent(layerList) {
        var extent = ol.extent.createEmpty();
        for (var layer in layerList) {
            var layerExtent = ol.proj.transformExtent([
                parseFloat(layerList[layer]['layerExtent']['minX']),
                parseFloat(layerList[layer]['layerExtent']['minY']),
                parseFloat(layerList[layer]['layerExtent']['maxX']),
                parseFloat(layerList[layer]['layerExtent']['maxY'])
            ], 'EPSG:4326', 'EPSG:3857');
            ol.extent.extend(extent, layerExtent);
        };
        map.getView().fit(extent, map.getSize());
    };

    /* Zooms to layer extent */
    function zoomToLayer() {
        var layerCode = activeLayer;
        zoomToExtent([layerList[layerCode]]);
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
        if (layerList[activeLayer]['layerType'] === 'basemap') {
            layerList[activeLayer]['layerSource'][layerList[activeLayer]['layerSymbology']['type']].setVisible(layerList[activeLayer]['layerVisible']);
            if (layerList[activeLayer]['layerVisible'] === true) {
                $('#map').css('background-color', 'lightgrey');
            } else {
                $('#map').css('background-color', 'white');
            };
        } else {
            layerList[activeLayer]['layerSource'].setVisible(layerList[activeLayer]['layerVisible']);
        };
    };

    /* Creates SVG Icon for Layer */
    function createLayerIcon(layerCode) {
        var layerType = layerList[layerCode]['layerType'];
        switch (layerType) {
            case 'point':
                var pointShape = layerList[layerCode]['layerSymbology']['shape'];
                var fillColor = layerList[layerCode]['layerSymbology']['fillColor'];
                var fillOpacity = layerList[layerCode]['layerSymbology']['fillOpacity'];
                var lineColor = layerList[layerCode]['layerSymbology']['strokeColor'];
                var lineOpacity = layerList[layerCode]['layerSymbology']['strokeOpacity'];
                switch (pointShape) {
                    case 'circle':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <circle class="layer-icon" cx="12" cy="12" r="7" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'square':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <rect class="layer-icon" x="5" y="5" width="14" height="14" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'triangle':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <polygon class="layer-icon" points="2 22, 22 22, 12 6" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2"/>
                            </svg>
                        `;
                        break;
                };
                break;
            case 'line':
                var lineColor = layerList[layerCode]['layerSymbology']['strokeColor'];
                var lineOpacity = layerList[layerCode]['layerSymbology']['strokeOpacity'];
                var layerIcon = `
                    <svg height="24" width="24">
                      <polyline class="layer-icon" points="1,23 20,18 5,7 23,1" fill-opacity="${lineOpacity}" style="fill:none;stroke:${lineColor};stroke-width:2" />
                    </svg>
                `;
                break;
            case 'polygon':
                var fillColor = layerList[layerCode]['layerSymbology']['fillColor'];
                var fillOpacity = layerList[layerCode]['layerSymbology']['fillOpacity'];
                var lineColor = layerList[layerCode]['layerSymbology']['strokeColor'];
                var lineOpacity = layerList[layerCode]['layerSymbology']['strokeOpacity'];
                var layerIcon = `
                    <svg height="24" width="24">
                      <polygon class="layer-icon" points="1,23 5,5 20,1 23,20" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                    </svg>
                `;
                break;
            case 'raster':
                var colorMap = layerList[layerCode]['layerSymbology']['colormap'];
                var minValue = layerList[layerCode]['layerProperties'][0]['min_value'];
                var maxValue = layerList[layerCode]['layerProperties'][0]['max_value'];
                var svgGradient = ``
                for (var i = 0; i < colorMap['colors'].length; i++) { 
                    svgGradient = svgGradient + `<stop offset="${(((colorMap['positions'][i] - minValue) / (maxValue - minValue)) * 100).toString()}%" style="stop-color:${colorMap['colors'][i]};stop-opacity:1" />`
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

    /* Updates data viewer for currently selected layer */
    function updateDataViewer(e, dt, type, indexes) {
        // Hides Old Attribute Data
        $('#attribute-table-container').addClass('hidden');
        $('#attr-loading').removeClass('hidden');
        $('#attr-error').addClass('hidden');

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
        $('#layer-name-input').val(layerList[activeLayer]['layerName']);
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
                $('#line-size-input').val(layerList[layerCode]['layerSymbology']['strokeWidth']);
                $('#point-size-container').removeClass('hidden');
                $('#point-size-input').val(layerList[layerCode]['layerSymbology']['size']);
                $('#point-shape-container').removeClass('hidden');
                $('#point-shape-input').val(layerList[layerCode]['layerSymbology']['shape']);
                symbologyColorPicker('#fill-color-selector', layerList[layerCode]['layerSymbology']['fillColor'], layerList[layerCode]['layerSymbology']['fillOpacity']);
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layerSymbology']['strokeColor'], layerList[layerCode]['layerSymbology']['strokeOpacity']);
                break;
            case 'line':
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#remove-layer-btn').removeClass('hidden');
                $('#attr-table-tab').removeClass('hidden');
                $('#line-color-container').removeClass('hidden');
                $('#line-size-container').removeClass('hidden');
                $('#line-size-input').val(layerList[layerCode]['layerSymbology']['strokeWidth']);
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layerSymbology']['strokeColor'], layerList[layerCode]['layerSymbology']['strokeOpacity']);
                break;
            case 'polygon':
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#remove-layer-btn').removeClass('hidden');
                $('#attr-table-tab').removeClass('hidden');
                $('#fill-color-container').removeClass('hidden');
                $('#line-color-container').removeClass('hidden');
                $('#line-size-container').removeClass('hidden');
                $('#line-size-input').val(layerList[layerCode]['layerSymbology']['strokeWidth']);
                symbologyColorPicker('#fill-color-selector', layerList[layerCode]['layerSymbology']['fillColor'], layerList[layerCode]['layerSymbology']['fillOpacity']);
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layerSymbology']['strokeColor'], layerList[layerCode]['layerSymbology']['strokeOpacity']);
                break;
            case 'raster':
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#remove-layer-btn').removeClass('hidden');
                $('#color-map-container').removeClass('hidden');
                break;
            case 'basemap':
                $('#basemap-container').removeClass('hidden');
                $('#basemap-select').val(layerList[layerCode]['layerSymbology']['type']);
                break;
        };

        // Show the data viewer
        showDataViewer();

        // Update Attribute Table
        setUpAttributeTable(layerCode);
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

    /* Disables data viewer when no layers are selected */
    function disableDataViewer(e, dt, type, indexes) {
        hideDataViewer();
        activeLayer = null;
        $('#data-viewer-show').addClass('hidden');
    };

    /* Converts hex colors to rgb colors */
    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            'r': parseInt(result[1], 16),
            'g': parseInt(result[2], 16),
            'b': parseInt(result[3], 16)
        } : null;
    };

    /* Initializes color picker for layer symbology */
    function symbologyColorPicker(element, defaultColor, a) {
        var rgb = hexToRgb(defaultColor);
        var rgbaColor = `rgba(${rgb['r']}, ${rgb['g']}, ${rgb['b']}, ${a})`;
        $(element).spectrum({
            color: rgbaColor,
            showPalette: true,
            showButtons: true,
            showInitial: true,
            chooseText: "Update",
            cancelText: "Cancel",
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
            showAlpha: true,
            hide: function(color) {
                updateLayerSymbology(null);
            }
        });
    };

    /* Changes the data viewer tab */
    function changeDataViewerTab() {
        $('.data-viewer-tabs > li').removeClass('active');
        $(this).addClass('active');
        $('.data-viewer-content-page').addClass('hidden');
        $(`#${$(this).attr('id')}-view`).removeClass('hidden');
    };

    /* Changes Basemap */
    function changeBasemap(evt) {
        layerList['0000000000']['layerSymbology']['type'] = $(this).val();
        layerList['0000000000']['layerSource']['satellite'].setVisible(false);
        layerList['0000000000']['layerSource']['street'].setVisible(false);
        layerList['0000000000']['layerSource']['grey'].setVisible(false);
        layerList['0000000000']['layerSource']['dark'].setVisible(false);
        layerList['0000000000']['layerSource'][$(this).val()].setVisible(true);
    };

    /* Changes Layer Display Name */
    function changeLayerDisplayName(evt) {
        layerList[activeLayer]['displayName'] = $('#layer-name-input').val();
        layerTable.rows().every(function(){
            var tableRow = this.data();
            var layerCode = tableRow[1];
            if (layerCode === activeLayer) {
                layerTable.cell(this[0][0], 3).data(layerList[activeLayer]['displayName'])
            };
        });
    };

    /* Changes Layer Symbology */
    function updateLayerSymbology(evt) {
        var layerType = layerList[activeLayer]['layerType'];
        var sldBodyOld = SLD_TEMPLATES.getLayerSLD(layerList[activeLayer]['layerType'], layerList[activeLayer]['layerId'], layerList[activeLayer]['layerSymbology']);
        switch (layerType) {
            case 'point':
                layerList[activeLayer]['layerSymbology']['shape'] = $('#point-shape-input').val();
                layerList[activeLayer]['layerSymbology']['size'] = $('#point-size-input').val();
                layerList[activeLayer]['layerSymbology']['fillColor'] = $('#fill-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['fillOpacity'] = $('#fill-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#line-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#line-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeWidth'] = $('#line-size-input').val();
                break;
            case 'line':
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#line-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#line-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeWidth'] = $('#line-size-input').val();
                break;
            case 'polygon':
                layerList[activeLayer]['layerSymbology']['fillColor'] = $('#fill-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['fillOpacity'] = $('#fill-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#line-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#line-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeWidth'] = $('#line-size-input').val();
                break;
            case 'raster':
                var colorMap = getColorMap($('#color-map-input').val(), layerList[activeLayer]['layerProperties'][0]['max_value'], layerList[activeLayer]['layerProperties'][0]['min_value']);
                layerList[activeLayer]['layerSymbology']['colormap'] = colorMap;
                break;
        };
        var sldBody = SLD_TEMPLATES.getLayerSLD(layerList[activeLayer]['layerType'], layerList[activeLayer]['layerId'], layerList[activeLayer]['layerSymbology']);
        if (sldBodyOld !== sldBody) {
            layerList[activeLayer]['layerWMS'].updateParams({'SLD_BODY': sldBody});
        };
        updateLayerIcon(activeLayer);
    };

    /* Removes a Layer from the Session */
    function removeLayer(evt) {
        layerTable.row('.selected').remove().draw(false);
        map.removeLayer(layerList[activeLayer]['layerSource']);
        delete layerList[activeLayer];
        activeLayer = null;
        disableDataViewer();
    };

    /* Gets CSRF Token for AJAX Requests */
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                };
            };
        };
        return cookieValue;
    };

    /* Sets up Attribute Table for Layer */
    function setUpAttributeTable(layerCode) {
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            data: {
                'layer_id': layerList[layerCode]['layerId'],
                'layer_code': layerCode
            },
            url: 'get-attribute-table/',
            success: function(response) {
                if (response['success'] === true) {
                    var layerCode = response['results']['layer_code'];
                    if (activeLayer === layerCode) {
                        populateAttributeTable(response['results']['layer_properties']);
                    };
                } else {
                    console.log('Layer Load Failed')
                };
            },
            error: function(response) {
                console.log('Layer Load Failed')
            }
        });
    };

    /* Populates Attribute Table with Data */
    function populateAttributeTable(tableData) {
        var tableHead = '<thead><th>Feature</th>';
        for (var i = 0; i < tableData['properties'].length; i++) {
            tableHead = tableHead + '<th>' + tableData['properties'][i] + '</th>';
        };
        tableHead = tableHead + '</thead>';
        try {
            attributeTable.destroy();
        } catch(err) {};
        $('#attribute-table').html(tableHead);
        attributeTable = $('#attribute-table').DataTable({
            'select': {
                'style': 'single'
            },
            'searching': false, 
            'paging': false, 
            'info': false,
            'autoWidth': false,
            'scrollY': '170px',
            'scrollX': true,
            'deferRender': true,
            'scrollCollapse': true
        });
        for (var i = 0; i < tableData['values'].length; i++) {
            attributeTable.row.add([i + 1].concat(tableData['values'][i]));
        };
        attributeTable.draw();
        $('#attribute-table-container').removeClass('hidden');
        $('#attr-loading').addClass('hidden');
        $('#attr-error').addClass('hidden');
        attributeTable.draw();
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