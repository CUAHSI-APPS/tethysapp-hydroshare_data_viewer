(function packageHydroShareHISDataViewer() {

    'use strict';

    /*****************************************************************************************
     *********************************** GLOBAL VARIABLES ************************************
     *****************************************************************************************/

    var map;
    var mapBasemaps;
    var layerTable;
    var discoverTable;
    var attributeTable;
    var layerList = {};
    var activeLayer = null;
    var timeseriesPlot = null;

    /*****************************************************************************************
     ******************************** FUNCTION DECLARATIONS **********************************
     *****************************************************************************************/

    /* Initializes HydroShare HIS Data Viewer App. */
    function initApp() {

        // Gets URL query parameters.
        var urlParams = new URLSearchParams(window.location.search);
        var resList = [...new Set(urlParams.getAll('res_id'))];
        var aggList = [...new Set(urlParams.getAll('agg_id'))];
        if (resList.length > 1) {
            var layerId = null;
        } else if (aggList.length >= 1) {
            var layerId = resList[0] + ':' + aggList[0]
        } else {
            var layerId = null;
        };

        // Initializes map div.
        map = new ol.Map({
            target: 'map',        
            view: new ol.View({
                center: ol.proj.transform([0, 0], 'EPSG:4326', 'EPSG:3857'),
                zoom: 1.8,
                minZoom: 1.8,
                maxZoom: 17
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
        layerTable = $('#workspace-table').DataTable({
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
			    $(row).addClass('workspace-table-row');
			}
        });

        layerTable.on('row-reorder', reorderMapLayers);
        layerTable.on('select', updateDataViewer);
        layerTable.on('deselect', disableDataViewer);

        // Initializes Discover Table
        discoverTable = $('#discover-table').DataTable({
            /*'select': {
                'style': 'single'
            },*/
            'searching': true,
            'paging': false, 
            'info': false,
            'columnDefs': [
                {'visible': false, 'targets': [0,1]}
            ],
            'createdRow': function( row, data, dataIndex ) {
                $(row).addClass('discover-table-row');
            }
        });

        discoverTable.on('select', updateResourceViewer);
        //discoverTable.on('deselect', disableDataViewer);

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
            `<img id="basemap-icon" src="/static/hydroshare_gis_data_viewer/images/basemap.svg"/>`,
            layerList[layerCode]['layerName'],
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('workspace-layer-icon');
        $(rowNode).find('td').eq(1).addClass('workspace-layer-name');
        $(rowNode).find('td').eq(2).addClass('workspace-layer-move');

        // Sets initial nav tab.
        if (resList.length > 0) {
            toggleNavTabs('workspace');
        } else {
            toggleNavTabs('discover');
        };

        // Adds HydroShare resource layers to map.
        getHydroShareLayers(resList, layerId, 'initial');

        // Gets list of available layers.
        getDiscoveryLayerList();

        // 
        updateMapSize();
    };

    /* Gets layers to add to map */
    function getHydroShareLayers(resIdList, layerId, requestType) {
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            data: {
                'resource_id_list': resIdList,
                'layer_id': layerId,
                'request_type': requestType
            },
            url: 'get-hydroshare-layers/',
            success: function(response) {
                if (response['success'] === true) {
                    for (var layerCode in response['results']) {
                        var statusCode = addLayerToMap(layerCode, response['results'][layerCode]);
                    };
                    if (response['message'] === 'post') {
                        if (!$.isEmptyObject(response['results'])) {
                            $('#add-resource-modal').modal('hide');
                            $('#add-resource-message').addClass('hidden');
                        } else {
                            $('#add-resource-message').text('Unable to add any layers from this resource.');
                        };
                    };
                    zoomToExtent(response['results']);
                } else {
                    console.log('Layer Load Failed');
                };
            },
            error: function(response) {
                console.log('Layer Load Failed');
            }
        });
    };

    /* Adds a layer to the map */
    function addLayerToMap(layerCode, layer) {

        // Checks if max layer count has been reached
        if (Object.keys(layerList).length > 8) {
            updateDiscoveryList(layer['layerId'], 'remove');
            return 'max';
        };

        // Checks if layer has already been added
        var layerIdList = []
        for (var i in layerList) {
            layerIdList.push(layerList[i]['layerId']);
        };
        if (layerIdList.includes(layer['layerId'])) {
            return null;
        };

        // Gets layer data
        layerList[layerCode] = layer;
        layerList[layerCode]['layerSymbology'] = getLayerSymbology(layerCode);
        layerList[layerCode]['layerVisible'] = true;

        // Updates row order number
        layerTable.rows().eq(0).each(function(index) {
            var cell = layerTable.cell(index, 0);
            cell.data(parseInt(cell.data(), 10) + 1).draw();
        });

        // Adds row to workspace layer list
        var rowNode = layerTable.row.add([
            1,
            layerCode,
            layer['layerId'],
            layer['layerName'],
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('workspace-layer-icon');
        $(rowNode).find('td').eq(1).addClass('workspace-layer-name');
        $(rowNode).find('td').eq(2).addClass('workspace-layer-move');

        // Gets SLD body for layer
        var sldBody = SLD_TEMPLATES.getLayerSLD(layerList[layerCode]['layerType'], layerList[layerCode]['layerId'], layerList[layerCode]['layerSymbology']);

        // Adds vector or raster layer
        if (layerList[layerCode]['layerType'] === 'point' || layerList[layerCode]['layerType'] === 'line' || layerList[layerCode]['layerType'] === 'polygon' || layerList[layerCode]['layerType'] === 'raster') {

            // Creates layer WMS object
            layerList[layerCode]['layerWMS'] = new ol.source.ImageWMS({
                url: 'https://geoserver-beta.hydroshare.org/geoserver/wms',
                params: {'LAYERS': layerList[layerCode]['layerId'], 'SLD_BODY': sldBody},
                serverType: 'geoserver',
                crossOrigin: 'Anonymous'
            });

            // Adds spinning icon to layer while layer is loading
            layerList[layerCode]['layerWMS'].on('imageloadstart', function() {
                layerTable.rows().every(function() {
                    var tableRow = this.data();
                    var tableLayerCode = tableRow[1];
                    if (tableLayerCode === layerCode) {
                        layerTable.cell(this[0][0], 2).data('<img class="workspace-layer-icon" src="/static/hydroshare_gis_data_viewer/images/spinner.gif">');
                    };
                });
            });

            // Adds layer icon to layer when layer finishes loading
            layerList[layerCode]['layerWMS'].on('imageloadend', function() {
                var layerIcon = createLayerIcon(layerCode);
                layerTable.rows().every(function() {
                    var tableRow = this.data();
                    var tableLayerCode = tableRow[1];
                    if (tableLayerCode === layerCode) {
                        layerTable.cell(this[0][0], 2).data(layerIcon);
                    };
                });
            });

            // Creates layer image object
            layerList[layerCode]['layerSource'] = new ol.layer.Image({
                source: layerList[layerCode]['layerWMS']
            });

            // Add layer to map
            map.addLayer(layerList[layerCode]['layerSource']);

        };

        // Adds time series layer
        if (layerList[layerCode]['layerType'] === 'timeseries') {

            // Creates layer WFS object
            layerList[layerCode]['layerWFS'] = new ol.source.Vector({
                features: (new ol.format.GeoJSON()).readFeatures(layerList[layerCode]['layerGeometry'],{
                    featureProjection: 'EPSG:3857'
                })
            });

            // Removes extra GeoJSON
            delete layerList[layerCode]['layerGeometry']

            // Creates layer WFS image
            layerList[layerCode]['layerSource'] = new ol.layer.Vector({
                renderMode: 'image',
                source: layerList[layerCode]['layerWFS'],
                style: sldBody
            });

            // Add layer to map
            map.addLayer(layerList[layerCode]['layerSource']);

            // Updates layer icon in workspace list
            var layerIcon = createLayerIcon(layerCode);
            layerTable.rows().every(function() {
                var tableRow = this.data();
                var tableLayerCode = tableRow[1];
                if (tableLayerCode === layerCode) {
                    layerTable.cell(this[0][0], 2).data(layerIcon);
                };
            });
        };

        // Reorders map layers
        reorderMapLayers();

        // Updates Discover Table
        updateDiscoveryList(layerList[layerCode]['layerId'], 'add');

        return layerCode;
    };

    /* Gets a list of available layers to add to the discover list */
    function getDiscoveryLayerList() {
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            url: 'get-discovery-layer-list/',
            success: function(response) {
                if (response['success'] === true) {
                    populateDiscoveryList(response['results'])
                } else {
                    console.log('Get Layer List Failed');
                };
            },
            error: function(response) {
                console.log('Get Layer List Failed');
            }
        });
    };

    /* Adds rows to discover table */
    function populateDiscoveryList(layerList) {
        for (var i = 0; i < layerList.length; i++) {
            switch (layerList[i]['type']) {
                case 'VECTOR':
                    var layerId = layerList[i]['id']
                    var discoverLayerIcon = `<img class="discover-layer-icon-image" src="/static/hydroshare_gis_data_viewer/images/GeographicFeatureResource.png"/>`;
                    break;
                case 'RASTER':
                    var layerId = layerList[i]['id']
                    var discoverLayerIcon = `<img class="discover-layer-icon-image" src="/static/hydroshare_gis_data_viewer/images/RasterResource.png"/>`;
                    break;
                case 'TIMESERIES':
                    var layerId = `${layerList[i]['resource_id']}:${layerList[i]['id']}`
                    var discoverLayerIcon = `<img class="discover-layer-icon-image" src="/static/hydroshare_gis_data_viewer/images/TimeseriesResource.png"/>`;
            };
            var rowNode = discoverTable.row.add([
                layerId,
                layerList[i]['resource_id'],
                discoverLayerIcon,
                layerList[i]['name'],
                `<span class="add-layer-button glyphicon glyphicon-plus"></span>`
            ]).draw(false).node();
            $(rowNode).find('td').eq(0).addClass('discover-layer-icon');
            $(rowNode).find('td').eq(1).addClass('discover-layer-name');
            $(rowNode).find('td').eq(2).addClass('discover-layer-add');
        };
        updateDiscoveryList(null, 'update');
    };

    /* Adds a HydroShare resource to the session */
    function addHydroShareResource(evt) {
        var resId = $('#resource-id-input').val();
        if (resId.match("^[A-z0-9]+$")) {
            $('#add-resource-message').html('Loading...');
            $('#add-resource-message').removeClass('hidden');
            getHydroShareLayers([resId], null, 'post');
        } else {
            alert("Please enter a valid HydroShare Resource ID");
        };
    };

    /* Adds a layer from the discovery list */
    function addLayerFromDiscoveryList(evt) {

        // Gets data from clicked row
        var data = discoverTable.row($(this).parents('tr')).data();

        // Adds spinner icon to discover table
        discoverTable.cell($(this).parents('td')).data('<img class="discover-layer-loading-icon" src="/static/hydroshare_gis_data_viewer/images/spinner.gif">');

        // Adds layers to map
        getHydroShareLayers([data[1]], data[0], 'discover');
    };

    /* Updates Discover Table when data is added to Workspace */
    function updateDiscoveryList(layerId, event) {
        try {
            switch (event) {
                case 'add':
                    var index = discoverTable.rows().eq( 0 ).filter( function (rowIdx) {
                        return discoverTable.cell( rowIdx, 0 ).data() === layerId ? true : false;
                    } );
                    discoverTable.cell(index[0],4).data('<span class="layer-added glyphicon glyphicon-ok"></span>');
                    break;
                case 'remove':
                    var index = discoverTable.rows().eq( 0 ).filter( function (rowIdx) {
                        return discoverTable.cell( rowIdx, 0 ).data() === layerId ? true : false;
                    } );
                    discoverTable.cell(index[0],4).data('<span class="add-layer-button glyphicon glyphicon-plus"></span>');
                    break;
                case 'update':
                    for (var layerCode in layerList) {
                        if (layerCode !== '0000000000') {
                            updateDiscoveryList(layerList[layerCode]['layerId'], 'add');
                        };
                    };
                    break;
            };
        } catch {};
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
            case 'timeseries':
                var layerSymbology  = {
                    'type': 'simple',
                    'shape': 'circle',
                    'fillColor': initialColors[Math.floor(Math.random() * 31)],
                    'fillOpacity': 1,
                    'strokeColor': '#000000',
                    'strokeOpacity': 1,
                    'strokeWidth': 1,
                    'size': 6
                };
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
                    'colormapName': 'gray',
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
                    layerList[layerCode]['layerSource']['satellite'].setZIndex(1000 - tableRow[0]);
                    layerList[layerCode]['layerSource']['street'].setZIndex(1000 - tableRow[0]);
                    layerList[layerCode]['layerSource']['grey'].setZIndex(1000 - tableRow[0]);
                    layerList[layerCode]['layerSource']['dark'].setZIndex(1000 - tableRow[0]);
                } else {
                    layerList[layerCode]['layerSource'].setZIndex(1000 - tableRow[0]);
                };
            });
        }, 100);
    };

    /* Updates the map size when the window is resized */
    function updateMapSize() {
        var timeout = 200;
        setTimeout(function() {
            map.updateSize();
            try {
                timeseriesPlot.render();
                timeseriesPlot.update();
            } catch(e) {};
        }, timeout);
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
            case 'timeseries':
                var pointShape = layerList[layerCode]['layerSymbology']['shape'];
                var fillColor = layerList[layerCode]['layerSymbology']['fillColor'];
                var fillOpacity = layerList[layerCode]['layerSymbology']['fillOpacity'];
                var lineColor = layerList[layerCode]['layerSymbology']['strokeColor'];
                var lineOpacity = layerList[layerCode]['layerSymbology']['strokeOpacity'];
                switch (pointShape) {
                    case 'circle':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <circle class="workspace-layer-icon" cx="12" cy="12" r="7" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'square':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <rect class="workspace-layer-icon" x="5" y="5" width="14" height="14" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'triangle':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <polygon class="workspace-layer-icon" points="2 22, 22 22, 12 6" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2"/>
                            </svg>
                        `;
                        break;
                };
                break;
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
                                <circle class="workspace-layer-icon" cx="12" cy="12" r="7" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'square':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <rect class="workspace-layer-icon" x="5" y="5" width="14" height="14" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'triangle':
                        var layerIcon = `
                            <svg height="24" width="24">
                                <polygon class="workspace-layer-icon" points="2 22, 22 22, 12 6" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2"/>
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
                      <polyline class="workspace-layer-icon" points="1,23 20,18 5,7 23,1" fill-opacity="${lineOpacity}" style="fill:none;stroke:${lineColor};stroke-width:2" />
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
                      <polygon class="workspace-layer-icon" points="1,23 5,5 20,1 23,20" fill-opacity="${fillOpacity}" stroke-opacity="${lineOpacity}" style="fill:${fillColor};stroke:${lineColor};stroke-width:2" />
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
                      <rect class="workspace-layer-icon" width="24" height="24" fill="url(#${'grad-' + layerCode})" />
                    </svg>
                `;
                break;
        };
        return layerIcon;
    };

    function updateResourceViewer(e, dt, type, indexes) {

        console.log(discoverTable.rows(indexes).data().toArray())
    };

    /* Updates data viewer for currently selected layer */
    function updateDataViewer(e, dt, type, indexes) {

        // Hides Old Attribute Data
        $('#attribute-table-container').addClass('hidden');
        $('#attr-loading').removeClass('hidden');
        $('#attr-error').addClass('hidden');

        // Sets the active layer
        var layerCode = layerTable.rows(indexes).data().toArray()[0][1]
        var layerType = layerList[layerCode]['layerType'];
        activeLayer = layerCode;

        // Resets the active tab
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
        $('#resource-info-tab').removeClass('hidden');

        if (layerList[layerCode]['layerVisible'] === true) {
            $('#hide-layer-btn').removeClass('hidden');
        } else {
            $('#show-layer-btn').removeClass('hidden');
        };

        try {
            $('#ts-plot-tab').addClass('ts-plot-disabled');
            timeseriesPlot.destory();
        } catch(e) {};

        switch(layerType) {
            case 'timeseries':
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#download-data-btn').removeClass('hidden');
                $('#remove-layer-btn').removeClass('hidden');
                $('#attr-table-tab').removeClass('hidden');
                $('#ts-plot-tab').removeClass('hidden');
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
            case 'point':
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#download-data-btn').removeClass('hidden');
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
                $('#download-data-btn').removeClass('hidden');
                $('#remove-layer-btn').removeClass('hidden');
                $('#attr-table-tab').removeClass('hidden');
                $('#line-color-container').removeClass('hidden');
                $('#line-size-container').removeClass('hidden');
                $('#line-size-input').val(layerList[layerCode]['layerSymbology']['strokeWidth']);
                symbologyColorPicker('#line-color-selector', layerList[layerCode]['layerSymbology']['strokeColor'], layerList[layerCode]['layerSymbology']['strokeOpacity']);
                break;
            case 'polygon':
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#download-data-btn').removeClass('hidden');
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
                $('#color-map-input').val(layerList[layerCode]['layerSymbology']['colormapName']);
                $('#zoom-to-layer-btn').removeClass('hidden');
                $('#download-data-btn').removeClass('hidden');
                $('#remove-layer-btn').removeClass('hidden');
                $('#color-map-container').removeClass('hidden');
                break;
            case 'basemap':
                $('#basemap-container').removeClass('hidden');
                $('#basemap-select').val(layerList[layerCode]['layerSymbology']['type']);
                break;
        };

        // Shows the data viewer
        showDataViewer();

        // Updates Attribute Table
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
        if (!$(this).hasClass('ts-plot-disabled')) {
            $('.data-viewer-tabs > li').removeClass('active');
            $(this).addClass('active');
            $('.data-viewer-content-page').addClass('hidden');
            $(`#${$(this).attr('id')}-view`).removeClass('hidden');
        };
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
        layerList[activeLayer]['layerName'] = $('#layer-name-input').val();
        layerTable.rows().every(function(){
            var tableRow = this.data();
            var layerCode = tableRow[1];
            if (layerCode === activeLayer) {
                layerTable.cell(this[0][0], 3).data(layerList[activeLayer]['layerName']);
            };
        });
    };

    /* Changes Layer Symbology */
    function updateLayerSymbology(evt) {
        var layerType = layerList[activeLayer]['layerType'];
        var sldBodyOld = SLD_TEMPLATES.getLayerSLD(layerList[activeLayer]['layerType'], layerList[activeLayer]['layerId'], layerList[activeLayer]['layerSymbology']);
        switch (layerType) {
            case 'timeseries':
                layerList[activeLayer]['layerSymbology']['shape'] = $('#point-shape-input').val();
                layerList[activeLayer]['layerSymbology']['size'] = $('#point-size-input').val();
                layerList[activeLayer]['layerSymbology']['fillColor'] = $('#fill-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['fillOpacity'] = $('#fill-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#line-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#line-color-selector').spectrum('get')['_originalInput']['a'];
                layerList[activeLayer]['layerSymbology']['strokeWidth'] = $('#line-size-input').val();
                break;
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
                layerList[activeLayer]['layerSymbology']['colormapName'] = $('#color-map-input').val();
                break;
        };
        var sldBody = SLD_TEMPLATES.getLayerSLD(layerList[activeLayer]['layerType'], layerList[activeLayer]['layerId'], layerList[activeLayer]['layerSymbology']);
        if (sldBodyOld !== sldBody) {
            if (layerList[activeLayer]['layerType'] === 'point' || layerList[activeLayer]['layerType'] === 'line' || layerList[activeLayer]['layerType'] === 'polygon' || layerList[activeLayer]['layerType'] === 'raster') {
                layerList[activeLayer]['layerWMS'].updateParams({'SLD_BODY': sldBody});
            };
            if (layerList[activeLayer]['layerType'] === 'timeseries') {
                layerList[activeLayer]['layerSource'].setStyle(sldBody);

                var layerIcon = createLayerIcon(activeLayer);
                layerTable.rows().every(function() {
                    var tableRow = this.data();
                    var tableLayerCode = tableRow[1];
                    if (tableLayerCode === activeLayer) {
                        layerTable.cell(this[0][0], 2).data(layerIcon);
                    };
                });

            };
        };
    };

    /* Removes a Layer from the Session */
    function removeLayer(evt) {
        layerTable.row('.selected').remove().draw(false);
        map.removeLayer(layerList[activeLayer]['layerSource']);
        updateDiscoveryList(layerList[activeLayer]['layerId'], 'remove');
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
                'layer_code': layerCode,
                'layer_type': layerList[layerCode]['layerType']
            },
            url: 'get-attribute-table/',
            success: function(response) {
                if (response['success'] === true) {
                    var layerCode = response['results']['layer_code'];
                    if (activeLayer === layerCode) {
                        populateAttributeTable(response['results']['layer_properties']);
                    };
                } else {
                    console.log('Layer Load Failed');
                };
            },
            error: function(response) {
                console.log('Layer Load Failed');
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
        attributeTable.on('select', updatePlotViewer);
        for (var i = 0; i < tableData['values'].length; i++) {
            attributeTable.row.add([i + 1].concat(tableData['values'][i]));
        };
        attributeTable.draw();
        $('#attribute-table-container').removeClass('hidden');
        $('#attr-loading').addClass('hidden');
        $('#attr-error').addClass('hidden');
        attributeTable.draw();
    };

    /* Updates Plot Viewer */
    function updatePlotViewer(e, dt, type, indexes) {
        if (layerList[activeLayer]['layerType'] === 'timeseries' && e['type'] === 'select') {
            $('#plot-loading').removeClass('hidden');
            $('#plot').addClass('hidden');
            $('#ts-plot-tab').removeClass('ts-plot-disabled');
            var rowData = attributeTable.rows( { selected: true }).data();
            var extent = ol.extent.createEmpty();
            for (var layer in layerList) {
                var layerExtent = ol.proj.transformExtent([
                    parseFloat(rowData[0][12]),
                    parseFloat(rowData[0][11]),
                    parseFloat(rowData[0][12]),
                    parseFloat(rowData[0][11])
                ], 'EPSG:4326', 'EPSG:3857');
                ol.extent.extend(extent, layerExtent);
            };
            map.getView().fit(extent, map.getSize());
            $.ajax({
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                type: 'POST',
                data: {
                    'layer_id': layerList[activeLayer]['layerId'],
                    'site_code': rowData[0][2],
                    'var_code': rowData[0][4],
                    'site_name': rowData[0][1],
                    'var_name': rowData[0][3]
                },
                url: 'get-timeseries-data/',
                success: function(response) {
                    if (response['success'] === true) {
                        var timeseriesData = [];
                        for (var i = 0; i < response['results']['timeseries_data'].length; i++) {
                            console.log()
                            timeseriesData.push({
                                'x': Date.parse(response['results']['timeseries_data'][i][0]),
                                'y': parseFloat(response['results']['timeseries_data'][i][1])
                            })
                        };
                        timeseriesPlot = new CanvasJS.Chart('plot', {
                            height: 225,
                            responsive: true,
                            animationEnabled: true,
                            zoomEnabled: true,
                            title: {
                                text: response['results']['variable_name'] + ' at ' + response['results']['site_name']
                            },
                            axisX: {},
                            axisY: {
                                title: response['results']['variable_name'] + ' (' + response['results']['unit_name'] + ')',
                            },
                            data: [{
                                type:'line',
                                name: response['results']['variable_name'],
                                xValueType: 'dateTime',
                                xValueFormatString: 'DD MMM hh:mm TT',
                                dataPoints: timeseriesData
                            }]
                        });
                        $('#plot-loading').addClass('hidden');
                        $('#plot').removeClass('hidden');
                        updateMapSize();
                    } else {
                        console.log('Layer Load Failed');
                    };
                },
                error: function(response) {
                    console.log('Layer Load Failed');
                }
            });


        };
        if (layerList[activeLayer]['layerType'] === 'timeseries' && e['type'] === 'deselect') {
            $('#ts-plot-tab').addClass('ts-plot-disabled');
            timeseriesPlot.destory();
        };
    };

    /* Controls toggle between search tab and workspace tab */
    function toggleNavTabs(evt) {
        if ($(this).attr('id') === 'discover-tab-button' || evt === 'discover') {
            $('.workspace-content').hide();
            $('#workspace-tab-button').css('background-color', '#D3D3D3');
            $('#workspace-tab-button').css('border-bottom', '1px solid gray');
            $('#workspace-tab-button').css('border-left', '1px solid gray');
            $('#discover-tab-button').css('border-bottom', '1px solid white');
            $('#discover-tab-button').css('border-right', 'none');
            $('.discover-content').show();         
            $('#discover-tab-button').css('background-color', '#FFFFFF');
            disableDataViewer(null, null, null, null);
            layerTable.rows().deselect();
            activeLayer = null;
        };
        if ($(this).attr('id') === 'workspace-tab-button' || evt === 'workspace') {
            $('.workspace-content').show();
            $('#workspace-tab-button').css('background-color', '#FFFFFF');
            $('#workspace-tab-button').css('border-bottom', '1px solid white');
            $('#workspace-tab-button').css('border-left', 'none');
            $('#discover-tab-button').css('border-bottom', '1px solid gray');
            $('#discover-tab-button').css('border-right', '1px solid gray');
            $('.discover-content').hide();
            $('#discover-tab-button').css('background-color', '#D3D3D3');
        };
    };

    /* Cleans up Add Resource modal */
    function cleanAddResourceModal(evt) {
        $('#resource-id-input').val('');
        $('#add-resource-message').addClass('hidden');
    };

    /* Cleans up Create Resource modal */
    function cleanCreateResourceModal(evt) {
        $('#shapefile-upload').val('');
        $('#geotiff-upload').val('');
        $('#odm2-upload').val('');
        $('#create-res-title').val('');
        $('#create-res-abstract').val('');
        $('#create-res-keywords').val('');
    };

    /* Cleans up Export Map modal */
    function cleanExportMapModal(evt) {
        $('#export-map-title').val('');
        $('#export-map-abstract').val('');
        $('#export-map-keywords').val('');
        $('#chk-public').prop('checked', false);
    };

    /* Exports map PNG */
    function exportMapPNG(evt) {
        map.once('rendercomplete', function(event) {
            var canvas = event.context.canvas;
            if (navigator.msSaveBlob) {
                navigator.msSaveBlob(canvas.msToBlob(), 'map.png');
            } else {
                canvas.toBlob(function(blob) {
                    saveAs(blob, 'map.png');
                });
            };
        });
        map.renderSync();
    };

    /* Switches file upload input */
    function changeFileInput(evt) {
        $('#shapefile-upload').val('');
        $('#geotiff-upload').val('');
        $('#odm2-upload').val('');
        $('#shapefile-upload').addClass('hidden');
        $('#geotiff-upload').addClass('hidden');
        $('#odm2-upload').addClass('hidden');
        $('#' + $(this).val() + '-upload').removeClass('hidden');
    };

    /* Searches discover table */
    function searchDiscoverTable(evt) {
        var searchInput = $('#discover-input').val();
        discoverTable.columns(3).search(searchInput).draw();
    };

    /*****************************************************************************************
     ************************************** LISTENERS ****************************************
     *****************************************************************************************/

    /* Listener for toggling nav sidebar tabs */
    $(document).on('click', '.nav-tab-button', toggleNavTabs);

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

    /* Listener for adding a HydroShare resource */
    $(document).on('click', '#add-resource-btn', addHydroShareResource);

    /* Listener for cleaning up Add Resource modal when closed */
    $(document).on('hidden.bs.modal', '#add-resource-modal', cleanAddResourceModal);

    /* Listener for exporting map PNG */
    $(document).on('click', '#export-png-button', exportMapPNG);

    /* Listener for cleaning up create resource modal */
    $(document).on('hidden.bs.modal', '#create-resource-modal', cleanCreateResourceModal);

    /* Listener for cleaning up export map modal */
    $(document).on('hidden.bs.modal', '#export-map-modal', cleanExportMapModal);

    /* Listener for changing file input */
    $(document).on('change', '.local-file-select', changeFileInput);

    /* Listener for searching discover table on button click */
    $(document).on('keyup', '#discover-input', searchDiscoverTable);

    /* Listener for adding layer to map */
    $(document).on('click', '.add-layer-button', addLayerFromDiscoveryList);

    /*****************************************************************************************
     ************************************ INIT FUNCTIONS *************************************
     *****************************************************************************************/

    initApp();

}());