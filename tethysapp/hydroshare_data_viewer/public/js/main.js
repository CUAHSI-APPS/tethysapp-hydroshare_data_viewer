(function packageHydroShareDataViewer() {

    'use strict';

    /*****************************************************************************************
     *********************************** GLOBAL VARIABLES ************************************
     *****************************************************************************************/

    var map;
    var basemapImage;
    var basemapTerrain;
    var basemapLabels;
    var overviewMap;
    var discoverTable;
    var workspaceTable;
    var attributeTable;
    var timeseriesPlot;
    var discoverSearchTimeout;
    var resizeTimeout;
    var sliderTimeout;
    var layerList = {};
    var aggregationsList = [];
    var selectedLayer = {};
    var activeLayer = null;
    var activeResource = null;
    var activeFeature = null;

    /*****************************************************************************************
     ******************************** FUNCTION DECLARATIONS **********************************
     *****************************************************************************************/

    /* Initializes HydroShare HIS Data Viewer App */
    function initApp() {

        // Sets up OpenLayers map.
        buildMap();

        // Sets up discover table.
        $(document).ready(function(){
            buildDiscoverTable();
        });

        // Sets up layer table.
        $(document).ready(function(){
            buildWorkspaceTable();
            $('.workspace-loading-container').hide();
            if ($('#resource_id').text() !== 'None') {
                $('.workspace-loading-container').show();
                loadHydroShareData($('#resource_id').text());
            };
        });

        // Sets initial nav tab.
        if ($('#resource_id').text() !== 'None' || $('#aggregation_id').text() !== 'None') {
            toggleNavTabs('workspace');
        } else {
            toggleNavTabs('discover');
        };
    };

    /* Builds discover table */
    function buildDiscoverTable() {

        // Adds loading screen
        scrollY = $('#discover-table-container').height();

        // Remove existing table
        try {
            discoverTable.destroy();
            $('.discover-loading-container').show();
            $('#discover-table_info').remove();
        } catch {};

        // Initializes Discover Table
        discoverTable = $('#discover-table').DataTable({
            'select': {
                'style': 'single'
            },
            'searching': true,
            'serverSide': true,
            'order': [[ 2, 'desc' ]],
            'lengthChange': false,
            'ajax': {
                'url': '/apps/hydroshare-data-viewer/ajax/update-discover-table/',
                'type': 'POST',
                'headers': {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                'data': function(data) {
                    data.searchValue = $('#discover-input').val();
                },
                'dataSrc': function(json) {
                    for (var i = 0; i < json.data.length; i++) {
                        json.data[i][0] = `<img class="discover-icon" src="/static/hydroshare_data_viewer/images/composite.png">`
                    };
                    return json.data
                }
            },
            'drawCallback': function() {
                discoverTable.rows().eq(0).each(function(index){
                    var row = discoverTable.row(index);
                    var data = row.data();
                    if (data[2] === activeResource) {
                        row.select();
                    };
                });
            },
            'columnDefs': [
                {'visible': false, 'targets': [2]}
            ],
            'createdRow': function( row, data, dataIndex ) {
                $(row).addClass('nav-table-row');
            },
            'deferRender': true,
            'scrollY': scrollY,
            'language': {
                'loadingRecords': '<div class="main-loading-container"><img class="main-loading-animation" src="/static/hydroshare_data_viewer/images/grid.svg"></div>',
                'processing': '<div class="main-loading-container"><img class="main-loading-animation" src="/static/hydroshare_data_viewer/images/grid.svg"></div>'
            },
            'scroller': {
                'loadingIndicator': true,
                'displayBuffer': 4
            },
            'initComplete': (settings, json)=>{
                $('.discover-loading-container').hide();
                $('#discover-table_info').appendTo('#discover-section-footer');
            }
        });

        // Adds event listeners to Discover Table
        discoverTable.on('select', setActiveResource);
        discoverTable.on('deselect', setActiveResource);
    };

    /* Searches discover table */
    function searchDiscoverTable(evt) {

        // Clear timeout
        clearTimeout(discoverSearchTimeout);

        // Reset timeout
        discoverSearchTimeout = setTimeout(function() {
            buildDiscoverTable();
        }, 250);
    };

    /* Builds workspace table */
    function buildWorkspaceTable() {

        // Initializes Workspace Table
        workspaceTable = $('#workspace-table').DataTable({
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
                {'visible': false, 'targets': [0, 1]},
                {'visible': true, 'targets': [2, 3, 4]},    
            ],
            'createdRow': function( row, data, dataIndex ) {
                $(row).addClass('nav-table-row');
                $(row).attr('layer-code', data[1]);
            }
        });

        // Adds event listeners to Workspace Table
        workspaceTable.on('row-reorder', reorderMapLayers);
        workspaceTable.on('select', setActiveLayer);
        workspaceTable.on('deselect', setActiveLayer);
    };

    /* Builds OpenLayers map */
    function buildMap() {

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

        // Uses grab cursor when dragging the map.
        map.on('pointerdrag', function(evt) {
            map.getViewport().style.cursor = "grabbing";
        });
        map.on('pointerup', function(evt) {
            map.getViewport().style.cursor = "default";
        });

        // Don't close dropdown menu on inside click.
        $(document).on('click', '.dropdown-menu', function (e) {
            e.stopPropagation();
        });

        // Load initial basemap.
        updateBasemap();
    };

    /* Updates OpenLayers basemap */
    function updateBasemap() {

        // Remove existing basemap imagery.
        if (basemapImage) {
            map.removeLayer(basemapImage);
        };
        if (basemapLabels) {
            map.removeLayer(basemapLabels);
        };
        if (basemapTerrain) {
            map.removeLayer(basemapTerrain);
        };
        if (overviewMap) {
            map.removeControl(overviewMap);
        };

        // Set up basemap sources.
        switch ($('#basemap-menu input:radio:checked').val()) {
            case 'satellite':
                basemapImage = new ol.layer.Tile({
                    source: new ol.source.XYZ({ 
                        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png'
                    })
                });
                if ($('#labels-select').is(':checked')) {
                    basemapLabels = new ol.layer.Tile({
                        source: new ol.source.XYZ({
                            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}.png'
                        })
                    });
                } else {
                    basemapLabels = null;
                };
                break;
            case 'street':
                basemapImage = new ol.layer.Tile({
                    source: new ol.source.XYZ({ 
                        url: 'http://{1-4}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png'
                    })
                });
                if ($('#labels-select').is(':checked')) {
                    basemapLabels = new ol.layer.Tile({
                        source: new ol.source.XYZ({ 
                            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer/tile/{z}/{y}/{x}.png'
                        })
                    });
                } else {
                    basemapLabels = null;
                };
                break;
            case 'grey':
                basemapImage = new ol.layer.Tile({
                    source: new ol.source.XYZ({ 
                        url: 'http://{1-4}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'
                    })
                });
                if ($('#labels-select').is(':checked')) {
                    basemapLabels = new ol.layer.Tile({
                        source: new ol.source.XYZ({
                            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer/tile/{z}/{y}/{x}.png'
                        })
                    });
                } else {
                    basemapLabels = null;
                };
                break;
            case 'dark':
                basemapImage = new ol.layer.Tile({
                    source: new ol.source.XYZ({ 
                        url: 'http://{1-4}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
                    })
                });
                if ($('#labels-select').is(':checked')) {
                    basemapLabels = new ol.layer.Tile({
                        source: new ol.source.XYZ({
                            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}.png'
                        })
                    });
                } else {
                    basemapLabels = null;
                };
                break;
            case 'none':
                basemapImage = null;
                if ($('#labels-select').is(':checked')) {
                    basemapLabels = new ol.layer.Tile({
                        source: new ol.source.XYZ({ 
                            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places_Alternate/MapServer/tile/{z}/{y}/{x}.png'
                        })
                    });
                } else {
                    basemapLabels = null;
                };
                break;
            default:
                basemapImage = null;
                basemapLabels = null;
                break;
        };

        // Add relevant basemap layers to the map.
        if (basemapImage) {
            map.addLayer(basemapImage);
            $('#map').css('background-color', 'lightgrey');
        } else {
            $('#map').css('background-color', 'white');
        };
        if ($('#terrain-select').is(':checked')) {
            basemapTerrain = new ol.layer.Tile({
                opacity: 0.5,
                source: new ol.source.XYZ({
                    url: 'http://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}',
                })
            });
            map.addLayer(basemapTerrain);
        } else {
            basemapTerrain = null;
        };
        if ($('#overview-map-select').is(':checked')) {
            overviewMap = new ol.control.OverviewMap({
                collapsed: false,
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.OSM()
                    })
                ],
                collapsible: false
            });
            map.addControl(overviewMap);
        } else {
            map.removeControl(overviewMap);
            overviewMap = null;
        };
        if (basemapLabels) {
            map.addLayer(basemapLabels);
        };
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

    /* Debounce window resize events */
    function resizeWindow() {

        // Clear timeout
        clearTimeout(resizeTimeout);

        // Reset timeout
        resizeTimeout = setTimeout(function() {
            buildDiscoverTable();
        }, 250);
    };

    /* Refreshes layer display order based on layer list */
    function reorderMapLayers() {
        setTimeout(() => {
            $('#workspace-table').find('tbody').find('tr').each(function(i,r){
                layerList[$(r).attr('layer-code')]['layerSource'].setZIndex(100 - i);
            });
        }, 100);
    };

    /* Sets selected feature of a layer */
    function selectFeature() {
        var attributeRowSelected = attributeTable.rows({selected: true}).data();
        if (attributeRowSelected[0] != null) {
            if (selectedLayer['feature'] != attributeRowSelected[0][0]) {
                selectedLayer['feature'] = attributeRowSelected[0][0];
                var fields = []
                for (var i = 0; i < layerList[activeLayer]['layerFields'].length; i++) {
                    fields.push(layerList[activeLayer]['layerFields'][i]['fieldName'])
                };
                selectedLayer['fields'] = fields;
                selectedLayer['row'] = attributeRowSelected[0].slice(1);
                if (layerList[activeLayer]['layerType'] === 'timeseries') {
                    buildPlot();
                };
            };
        } else {
            $('#ts-plot').addClass('disabled-tab');
            selectedLayer = {};
        };
        updateLayerSymbology(true)
    };

    /* Zooms to map extent */
    function zoomToExtent(minX, minY, maxX, maxY) {
        var extent = ol.extent.createEmpty();
        var layerExtent = ol.proj.transformExtent([
            minX, minY, maxX, maxY
        ], 'EPSG:4326', 'EPSG:3857');
        ol.extent.extend(extent, layerExtent);
        map.getView().fit(extent, map.getSize());
    };

    /* Zooms to map layer */
    function zoomToLayer(evt) {
        var minX = layerList[activeLayer]['layerCoverage']['minX'];
        var minY = layerList[activeLayer]['layerCoverage']['minY'];
        var maxX = layerList[activeLayer]['layerCoverage']['maxX'];
        var maxY = layerList[activeLayer]['layerCoverage']['maxY'];
        zoomToExtent(minX, minY, maxX, maxY);
    };

    /* Debounce slider change events */
    function updateSlider() {

        // Clear timeout
        clearTimeout(sliderTimeout);

        // Reset timeout
        sliderTimeout = setTimeout(function() {
            updateLayerSymbology(null);
        }, 300);
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
            if (!($.isEmptyObject(selectedLayer))) {
                selectedLayer = {};
                $('#ts-plot').addClass('disabled-tab');
                updateLayerSymbology(true);
            };
            activeLayer = null;
            activeResource = null;
            activeFeature = null;
            updateDataViewer();
            buildDiscoverTable();
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
            if (!($.isEmptyObject(selectedLayer))) {
                selectedLayer = {};
                $('#ts-plot').addClass('disabled-tab');
                updateLayerSymbology(true);
            };
            activeLayer = null;
            activeResource = null;
            activeFeature = null;
            updateDataViewer();
            try {
                workspaceTable.rows().deselect();
            } catch {};
        };
    };

    /* Sets active resource */
    function setActiveResource(evt) {
        var discoverRowSelected = discoverTable.rows({selected: true}).data();
        if (discoverRowSelected[0] != null) {
            var discoverResource = discoverRowSelected[0][2];
        } else {
            var discoverResource = null;
        };
        if (discoverResource !== activeResource) {
            activeResource = discoverResource;
            updateDataViewer();
        };
    };

    /* Sets active layer */
    function setActiveLayer(evt) {
        var workspaceRowSelected = workspaceTable.rows({selected: true}).data();
        if (workspaceRowSelected[0] != null) {
            var workspaceLayer = workspaceRowSelected[0][1];
            var workspaceResource = workspaceRowSelected[0][1].split('-').slice(1).join('-').split(':')[0];
        } else {
            var workspaceLayer = null;
            var workspaceResource = null;
        };
        if (workspaceLayer !== activeLayer) {
            if (!($.isEmptyObject(selectedLayer))) {
                selectedLayer = {};
                $('#ts-plot').addClass('disabled-tab');
                updateLayerSymbology(true);
            };
            activeLayer = workspaceLayer;
            activeResource = workspaceResource;
            updateDataViewer();
        }
    };

    /* Updates Data Viewer */
    function updateDataViewer() {
        $('.data-viewer-page').hide();
        $('.data-viewer-tab').hide();
        $('.layer-options-container').hide();
        $('#show-layer-btn').addClass('hidden');
        $('#hide-layer-btn').addClass('hidden');
        $('.data-viewer-tab').removeClass('active-tab');
        $('#label-field-input').empty();
        if (activeLayer != null) {
            $('.resource-info-container').hide();
            $('.data-view-loading-container').show();
            getResourceMetadata(false, false);
            showDataViewer();
            if (layerList[activeLayer]['layerVisible']) {
                $('#hide-layer-btn').removeClass('hidden'); 
            } else {
                $('#show-layer-btn').removeClass('hidden'); 
            };
            $('#data-viewer-hide').removeClass('hidden');
            $('#resource-info').show();
            $('#layer-options').show();
            $('#layer-options').addClass('active-tab');
            $('#layer-options-view').show();
            $('#layer-actions-container').show();
            $('#layer-name-input').val(layerList[activeLayer]['layerName']);
            switch (layerList[activeLayer]['layerType']) {
                case 'timeseries':
                    $('#attr-table').show();
                    $('#ts-plot').show();
                    $('#layer-fill-container').show();
                    $('#layer-stroke-container').show();
                    $('#layer-labels-container').show();
                    buildAttributeTable();
                    break;
                case 'point':
                    $('#attr-table').show();
                    $('#layer-fill-container').show();
                    $('#layer-stroke-container').show();
                    $('#layer-labels-container').show();
                    buildAttributeTable();
                    break;
                case 'line':
                    $('#attr-table').show();
                    $('#layer-stroke-container').show();
                    $('#layer-labels-container').show();
                    buildAttributeTable();
                    break;
                case 'polygon':
                    $('#attr-table').show();
                    $('#layer-fill-container').show();
                    $('#layer-stroke-container').show();
                    $('#layer-labels-container').show();
                    buildAttributeTable();
                    break;
                case 'raster':
                    $('#layer-fill-container').show();
                    break;
            };
            updateSymbologyFields();
        } else if (activeResource != null) {
            $('.resource-info-container').hide();
            $('.data-view-loading-container').show();
            getResourceMetadata(false, true);
            showDataViewer();
            $('#data-viewer-hide').removeClass('hidden');
            $('#resource-info-view').show();
            $('#resource-info').show();
            $('#resource-info').addClass('active-tab');
        } else {
            hideDataViewer();
            $('#data-viewer-show').addClass('hidden');
        };
    };

    /* Shows the data viewer window */
    function showDataViewer() {
        $('.data-viewer-content').removeClass('hidden');
        $('#data-viewer-show').addClass('hidden');
        $('#data-viewer-hide').removeClass('hidden');
        $('#data-viewer-tabs').removeClass('hidden');
        updateMapSize();
    };

    /* Hides the data viewer window */
    function hideDataViewer() {
        $('.data-viewer-content').addClass('hidden');
        $('#data-viewer-show').removeClass('hidden');
        $('#data-viewer-hide').addClass('hidden');
        $('#data-viewer-tabs').addClass('hidden');
        updateMapSize();
    };

    /* Changes the data viewer tab */
    function changeDataViewerTab() {
        if (!$(this).hasClass('disabled-tab')) {
            $('.data-viewer-tab').removeClass('active-tab');
            $(this).addClass('active-tab');
            $('.data-viewer-page').hide();
            $(`#${$(this).attr('id')}-view`).show();
            if ($(this).attr('id') === 'attr-table') {
                $('#attribute-table').DataTable().ajax.reload();
            };
            if ($(this).attr('id') === 'ts-plot') {
                updateMapSize();
            };
        };
    };

    /* Removes a Layer from the Session */
    function removeLayer(evt) {
        workspaceTable.row('.selected').remove().draw(false);
        map.removeLayer(layerList[activeLayer]['layerSource']);
        delete layerList[activeLayer];
        activeLayer = null;
        activeResource = null;
        updateDataViewer();
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
        layerList[activeLayer]['layerSource'].setVisible(layerList[activeLayer]['layerVisible']);
    };

    /* Changes Layer Display Name */
    function renameLayer(evt) {
        layerList[activeLayer]['layerName'] = $('#layer-name-input').val();
        workspaceTable.rows().every(function(){
            var tableRow = this.data();
            var layerCode = tableRow[1];
            if (layerCode === activeLayer) {
                workspaceTable.cell(this[0][0], 3).data(layerList[activeLayer]['layerName']);
            };
        });
    };

    /* Cancels layer rename */
    function cancelRenameLayer(evt) {
        var layerName = layerList[activeLayer]['layerName'];
        $('#layer-name-input').val(layerName);
    };

    /* Gets resource metadata */
    function getResourceMetadata(addLayers, resourceZoom) {
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            data: {
                'resourceId': activeResource
            },
            url: '/apps/hydroshare-data-viewer/ajax/get-resource-metadata/',
            success: function(response) {
                if (response['resourceId'] === activeResource) {
                    $('#resource-title').text(response['resourceTitle']);
                    $('#resource-creator').text(response['creator']);
                    $('#resource-date-created').text(response['dateCreated']);
                    $('#resource-last-updated').text(response['lastUpdated']);
                    $('#resource-id').text(response['resourceId']);
                    $('#resource-link').text(response['resourceLink']);
                    $('#resource-link').attr('href', response['resourceLink']);
                    $('#resource-sharing-status').text(response['sharingStatus']);
                    $('#resource-type').text(response['resourceType']);
                    $('#resource-abstract').text(response['resourceAbstract']);
                    if (response['boundingBox'] !== null && resourceZoom === true) {
                        zoomToExtent(
                            parseFloat(response['boundingBox']['min_x']),
                            parseFloat(response['boundingBox']['min_y']),
                            parseFloat(response['boundingBox']['max_x']),
                            parseFloat(response['boundingBox']['max_y'])
                        );
                    };
                    buildAggregationList(response['layerList']);
                    $('.resource-info-container').show();
                    $('.data-view-loading-container').hide();
                    if (addLayers === true) {
                        $('.workspace-loading-container').hide();
                        for (var i = 0; i < response['layerList'].length; i++) {
                            addLayerToMap(response['layerList'][i]);
                        };
                    };
                };
            },
            error: function(response) {
                $('.workspace-loading-container').hide();
                console.log('Layer Load Failed');
            }
        });
    };

    /* Builds aggregation table */
    function buildAggregationList(aggregationList) {
        $('#resource-aggregation-list').empty();
        aggregationsList = aggregationList
        for (var i = 0; i < aggregationList.length; i++) {
            switch (aggregationList[i]['layerType']) {
                case 'point':
                case 'line':
                case 'polygon':
                    var aggregationIcon = `<img class="resource-aggregation-icon" src="/static/hydroshare_data_viewer/images/GeographicFeatureResource.png"/>`;
                    break;
                case 'raster':
                    var aggregationIcon = `<img class="resource-aggregation-icon" src="/static/hydroshare_data_viewer/images/RasterResource.png"/>`;
                    break;
                case 'timeseries':
                    var aggregationIcon = `<img class="resource-aggregation-icon" src="/static/hydroshare_data_viewer/images/TimeseriesResource.png"/>`;
                    break;
            };
            if (layerList[aggregationList[i]['layerCode']] === undefined) {
                var aggregationAction = '<div class="resource-aggregation-add resource-aggregation-action"><span class="glyphicon glyphicon-plus"></span></div>'
            } else if (layerList[aggregationList[i]['layerCode']]['layerCode'] === activeLayer) {
                var aggregationAction = '<div class="resource-aggregation-action"></div>'
            } else {
                var aggregationAction = '<div class="resource-aggregation-edit resource-aggregation-action"><span class="glyphicon glyphicon-pencil"></span></div>'
            };
            var aggregationRow = `<div class="resource-aggregation-row" layer_id="${aggregationList[i]['layerCode']}" layer_type="${aggregationList[i]['layerType']}">
                  ${aggregationIcon}
                  <div class="resource-aggregation-name">${aggregationList[i]['layerName']}</div>
                  ${aggregationAction}
                </div>`
            $('#resource-aggregation-list').append(aggregationRow);
        };
        if (aggregationList.length > 0) {
             $('#resource-aggregation-list').show();
             $('#aggregation-no-data').hide();
        } else {
             $('#resource-aggregation-list').hide();
             $('#aggregation-no-data').show();
        };
    };

    /* Adds a layer from resource tab */
    function dataViewerAddLayer(evt) {
        var aggregationData = aggregationsList[aggregationsList.findIndex(x => x.layerCode === $(this).parent().attr('layer_id'))];
        $(this).removeClass('resource-aggregation-add');
        $(this).addClass('resource-aggregation-loading');
        $(this).html('<img class="data-view-layer-loading-icon" src="/static/hydroshare_data_viewer/images/spinner.gif">');
        var layerAdded = addLayerToMap(aggregationData);
        if (layerAdded) {
            $(this).removeClass('resource-aggregation-loading');
            $(this).addClass('resource-aggregation-edit');
            $(this).html('<span class="glyphicon glyphicon-pencil"></span>');
        } else {
            $(this).removeClass('resource-aggregation-loading');
            $(this).addClass('resource-aggregation-add');
            $(this).html('<span class="glyphicon glyphicon-plus"></span>');
        };
    };

    /* Edits a layer from resource tab */
    function dataViewerEditLayer(evt) {
        var discoverResource = activeResource;
        toggleNavTabs('workspace');
        activeResource = discoverResource;
        activeLayer = $(this).parent().attr('layer_id');
        workspaceTable.rows().eq(0).each(function(index){
            var row = workspaceTable.row(index);
            var data = row.data();
            if (data[1] === activeLayer) {
                row.select();
            };
        });
        updateDataViewer();
        zoomToLayer(null);
    };

    /* Adds layer to map */
    function addLayerToMap(layerData) {

        // Checks layer count
        if (workspaceTable.rows().count() >= parseInt($('#max_layers').text())) {
            alert('Cannot add ' + layerData['layerName'] + '.\n\nMaximum layer count of ' + $('#max_layers').text() + ' layers has been reached. Please remove layers from the workspace to add others.');
            return false;
        };

        // Builds layer object
        var layerCode = layerData['layerCode'];
        layerList[layerCode] = layerData;

        // Updates row order number
        workspaceTable.rows().eq(0).each(function(index) {
            var cell = workspaceTable.cell(index, 0);
            cell.data(parseInt(cell.data(), 10) + 1).draw();
        });

        // Adds row to workspace layer list
        var rowNode = workspaceTable.row.add([
            1,
            layerCode,
            createLayerIcon(layerCode),
            layerList[layerCode]['layerName'],
            `<span class="glyphicon glyphicon-resize-vertical glyph-layer-move"></span>`
        ]).draw(false).node();

        $(rowNode).find('td').eq(0).addClass('workspace-layer-icon');
        $(rowNode).find('td').eq(1).addClass('workspace-layer-name');
        $(rowNode).find('td').eq(2).addClass('workspace-layer-move');

        // Gets SLD body for layer
        var sldBody = buildLayerStyle(layerData);

        // Creates layer WMS object
        layerList[layerCode]['layerWMS'] = new ol.source.ImageWMS({
            url: 'https://geoserver-beta.hydroshare.org/geoserver/wms',
            params: {'LAYERS': layerList[layerCode]['layerCode'], 'SLD_BODY': sldBody},
            serverType: 'geoserver',
            crossOrigin: 'Anonymous'
        });

        // Adds spinning icon to layer while layer is loading
        layerList[layerCode]['layerWMS'].on('imageloadstart', function() {
            workspaceTable.rows().every(function() {
                var tableRow = this.data();
                var tableLayerCode = tableRow[1];
                if (tableLayerCode === layerCode) {
                    workspaceTable.cell(this[0][0], 2).data('<img class="workspace-loading-icon" src="/static/hydroshare_data_viewer/images/spinner.gif">');
                };
            });
        });

        // Adds layer icon to layer when layer finishes loading
        layerList[layerCode]['layerWMS'].on('imageloadend', function() {
            var layerIcon = createLayerIcon(layerCode);
            workspaceTable.rows().every(function() {
                var tableRow = this.data();
                var tableLayerCode = tableRow[1];
                if (tableLayerCode === layerCode) {
                    workspaceTable.cell(this[0][0], 2).data(layerIcon);
                };
            });
        });

        // Creates layer image object
        layerList[layerCode]['layerSource'] = new ol.layer.Image({
            source: layerList[layerCode]['layerWMS']
        });

        // Add layer to map
        map.addLayer(layerList[layerCode]['layerSource']);

        //Reorder map layers
        reorderMapLayers();

        return true;
    };

    /* Gets statistics metadata for a layer field */
    function getFieldStats(layerType, layerCode, resourceId, fieldName, fieldType) {
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            data: {
                'layer_type': layerType,
                'layer_code': layerCode,
                'resource_id': resourceId,
                'field_name': fieldName,
                'field_type': fieldType
            },
            url: '/apps/hydroshare-data-viewer/ajax/get-field-statistics/',
            success: function(response) {
                layerList[response['layer_code']]['layerFields'][layerList[response['layer_code']]['layerFields'].findIndex(x => x.fieldName === response['field_name'])]['fieldStats'] = {
                    'min': response['min'],
                    'max': response['max']
                };
                updateLayerSymbology(true);
            },
            error: function(response) {
                console.log('Layer Load Failed');
            }
        });
    };

    /* Builds layer SLD */
    function buildLayerStyle(layerData) {

        if (layerData['layerSymbology']['labelField'] === 'none') {
            var labelRule = '';
        } else {
            var labelRule = '<FeatureTypeStyle>' +
                '<Rule>' +
                    '<TextSymbolizer>' +
                        '<Label>' +
                            '<ogc:PropertyName>' + layerData['layerSymbology']['labelField'] + '</ogc:PropertyName>' +
                        '</Label>' +
                        '<Font>' +
                            '<CssParameter name="font-family">' + layerData['layerSymbology']['labelFont'] + '</CssParameter>' +
                            '<CssParameter name="font-size">' + layerData['layerSymbology']['labelSize'] + '</CssParameter>' +
                            '<CssParameter name="font-style">normal</CssParameter>' +
                            '<CssParameter name="font-weight">bold</CssParameter>' +
                        '</Font>' +
                        '<Fill>' +
                            '<CssParameter name="fill">' + layerData['layerSymbology']['labelColor'] + '</CssParameter>' +
                            '<CssParameter name="fill-opacity">' + layerData['layerSymbology']['labelOpacity'] + '</CssParameter>' +
                        '</Fill>' +
                        '<LabelPlacement>' +
                            '<PointPlacement>' +
                                '<Displacement>' +
                                    '<DisplacementY>0</DisplacementY>' +
                                    '<DisplacementX>' + '0' + '</DisplacementX>' +
                                '</Displacement>' +
                            '</PointPlacement>' +
                        '</LabelPlacement>' +
                    '</TextSymbolizer>' +
                '</Rule>' +
            '</FeatureTypeStyle>';
        };

        if (selectedLayer['fields'] != null) {
            var filters = '';
            for (var i = 0; i < selectedLayer['fields'].length; i++) {
                if (selectedLayer['row'][i] != null && selectedLayer['row'][i] != '') {
                    filters = filters + '<ogc:PropertyIsEqualTo>' +
                        '<ogc:PropertyName>' + selectedLayer['fields'][i] + '</ogc:PropertyName>' +
                        '<ogc:Literal>' + selectedLayer['row'][i].toString().replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;') + '</ogc:Literal>' +
                    '</ogc:PropertyIsEqualTo>';
                };
            };
        } else {
            var filters = null;
        };

        switch (layerData['layerType']) {
            case 'timeseries':
            case 'point':
                if (filters != null) {
                    var filterRule = '<FeatureTypeStyle>' +
                        '<Rule>' +
                            '<ogc:Filter>' +
                                '<ogc:And>' +
                                    filters + 
                                '</ogc:And>' +
                            '</ogc:Filter>' +
                            '<PointSymbolizer>' +
                                '<Graphic>' +
                                    '<Mark>' +
                                        '<WellKnownName>' +
                                            layerData['layerSymbology']['fillShape'] +
                                        '</WellKnownName>' +
                                        '<Stroke>' +
                                            '<CssParameter name="stroke">' +
                                                '#42E9F5' +
                                            '</CssParameter>' +
                                            '<CssParameter name="stroke-width">' +
                                                (parseFloat(layerData['layerSymbology']['strokeSize']) + 2).toString() +
                                            '</CssParameter>' + 
                                        '</Stroke>' +
                                    '</Mark>' +
                                    '<Size>' +
                                        layerData['layerSymbology']['fillSize'] +
                                    '</Size>' +
                                '</Graphic>' +
                            '</PointSymbolizer>' +
                        '</Rule>' +
                    '</FeatureTypeStyle>';
                } else {
                    var filterRule = ''
                };
                switch (layerData['layerSymbology']['fillType']) {
                    case 'simple':
                        var sldRules = '<Rule>' +
                            '<PointSymbolizer>' +
                                '<Graphic>' +
                                    '<Mark>' +
                                        '<WellKnownName>' +
                                            layerData['layerSymbology']['fillShape'] +
                                        '</WellKnownName>' +
                                        '<Fill>' +
                                            '<CssParameter name="fill">' +
                                                layerData['layerSymbology']['fillColor'] +
                                            '</CssParameter>' +
                                            '<CssParameter name="fill-opacity">' +
                                                layerData['layerSymbology']['fillOpacity'] +
                                            '</CssParameter>' +
                                        '</Fill>' +
                                        '<Stroke>' +
                                            '<CssParameter name="stroke">' +
                                                layerData['layerSymbology']['strokeColor'] +
                                            '</CssParameter>' +
                                            '<CssParameter name="stroke-opacity">' +
                                                layerData['layerSymbology']['strokeOpacity'] +
                                            '</CssParameter>' + 
                                            '<CssParameter name="stroke-width">' +
                                                layerData['layerSymbology']['strokeSize'] +
                                            '</CssParameter>' + 
                                        '</Stroke>' +
                                    '</Mark>' +
                                    '<Size>' +
                                        layerData['layerSymbology']['fillSize'] +
                                    '</Size>' +
                                '</Graphic>' +
                            '</PointSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'gradient':
                        var fieldStats = layerData['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldStats'];
                        if (fieldStats === null) {
                            layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldStats'] = 'loading';
                            getFieldStats(
                                layerList[activeLayer]['layerType'], 
                                layerList[activeLayer]['layerCode'], 
                                layerList[activeLayer]['resourceId'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldName'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldType']
                            );
                            sldRules = '';
                        } else if (fieldStats === 'loading') {
                            sldRules = '';
                        } else {
                            var colormap = getColorMap(layerData['layerSymbology']['fillGradient'], fieldStats);
                            var gradValue = '';
                            for (var i = 0; i < colormap['positions'].length; i++) {
                                gradValue = gradValue + 
                                    '<ogc:Literal>' + colormap['positions'][i] + '</ogc:Literal>' +
                                    '<ogc:Literal>' + colormap['colors'][i] + '</ogc:Literal>'
                            };
                            var sldRules = '<Rule>' +
                                '<PointSymbolizer>' +
                                    '<Graphic>' +
                                        '<Mark>' +
                                            '<WellKnownName>' +
                                                layerData['layerSymbology']['fillShape'] +
                                            '</WellKnownName>' +
                                            '<Fill>' +
                                                '<CssParameter name="fill">' +
                                                    '<ogc:Function name="Interpolate">' +
                                                        '<ogc:PropertyName>' + layerData['layerSymbology']['fillField'] +'</ogc:PropertyName>' +
                                                        gradValue +
                                                        '<ogc:Literal>color</ogc:Literal>' +
                                                    '</ogc:Function>' +
                                                '</CssParameter>' +
                                                '<CssParameter name="fill-opacity">' +
                                                    layerData['layerSymbology']['fillOpacity'] +
                                                '</CssParameter>' +
                                            '</Fill>' +
                                            '<Stroke>' +
                                                '<CssParameter name="stroke">' +
                                                    layerData['layerSymbology']['strokeColor'] +
                                                '</CssParameter>' +
                                                '<CssParameter name="stroke-opacity">' +
                                                    layerData['layerSymbology']['strokeOpacity'] +
                                                '</CssParameter>' + 
                                                '<CssParameter name="stroke-width">' +
                                                    layerData['layerSymbology']['strokeSize'] +
                                                '</CssParameter>' + 
                                            '</Stroke>' +
                                        '</Mark>' +
                                        '<Size>' +
                                            layerData['layerSymbology']['fillSize'] +
                                        '</Size>' +
                                    '</Graphic>' +
                                '</PointSymbolizer>' +
                            '</Rule>';
                        };
                        break;
                };
                break;
            case 'line':
                if (filters != null) {
                    var filterRule = '<FeatureTypeStyle>' +
                        '<Rule>' +
                            '<ogc:Filter>' +
                                '<ogc:And>' +
                                    filters + 
                                '</ogc:And>' +
                            '</ogc:Filter>' +
                            '<LineSymbolizer>' +
                                '<Stroke>' +
                                    '<CssParameter name="stroke">' +
                                        '#42E9F5' +
                                    '</CssParameter>' +
                                    '<CssParameter name="stroke-width">' +
                                        (parseFloat(layerData['layerSymbology']['strokeSize']) + 2).toString() +
                                    '</CssParameter>' + 
                                '</Stroke>' +
                            '</LineSymbolizer>' +
                        '</Rule>' +
                    '</FeatureTypeStyle>';
                } else {
                    var filterRule = ''
                };
                switch (layerData['layerSymbology']['strokeType']) {
                    case 'simple':
                        var sldRules = '<Rule>' +
                            '<LineSymbolizer>' +
                                '<Stroke>' +
                                    '<CssParameter name="stroke">' +
                                        layerData['layerSymbology']['strokeColor'] +
                                    '</CssParameter>' +
                                    '<CssParameter name="stroke-opacity">' +
                                        layerData['layerSymbology']['strokeOpacity'] +
                                    '</CssParameter>' + 
                                    '<CssParameter name="stroke-width">' +
                                        layerData['layerSymbology']['strokeSize'] +
                                    '</CssParameter>' + 
                                '</Stroke>' +
                            '</LineSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'gradient':
                        var fieldStats = layerData['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['strokeField'])]['fieldStats'];
                        if (fieldStats === null) {
                            layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['strokeField'])]['fieldStats'] = 'loading';
                            getFieldStats(
                                layerList[activeLayer]['layerType'], 
                                layerList[activeLayer]['layerCode'], 
                                layerList[activeLayer]['resourceId'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['strokeField'])]['fieldName'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['strokeField'])]['fieldType']
                            );
                            sldRules = '';
                        } else if (fieldStats === 'loading') {
                            sldRules = '';
                        } else {
                            var colormap = getColorMap(layerData['layerSymbology']['strokeGradient'], fieldStats);
                            var gradValue = '';
                            for (var i = 0; i < colormap['positions'].length; i++) {
                                gradValue = gradValue + 
                                    '<ogc:Literal>' + colormap['positions'][i] + '</ogc:Literal>' +
                                    '<ogc:Literal>' + colormap['colors'][i] + '</ogc:Literal>'
                            };
                            var sldRules = '<Rule>' +
                                '<LineSymbolizer>' +
                                    '<Stroke>' +
                                        '<CssParameter name="stroke">' +
                                            '<ogc:Function name="Interpolate">' +
                                                '<ogc:PropertyName>' + layerData['layerSymbology']['strokeField'] +'</ogc:PropertyName>' +
                                                gradValue +
                                                '<ogc:Literal>color</ogc:Literal>' +
                                            '</ogc:Function>' +
                                        '</CssParameter>' +
                                        '<CssParameter name="stroke-opacity">' +
                                            layerData['layerSymbology']['strokeOpacity'] +
                                        '</CssParameter>' + 
                                        '<CssParameter name="stroke-width">' +
                                            layerData['layerSymbology']['strokeSize'] +
                                        '</CssParameter>' + 
                                    '</Stroke>' +
                                '</LineSymbolizer>' +
                            '</Rule>';
                        };
                        break;
                };
                break;
            case 'polygon':
                if (filters != null) {
                    var filterRule = '<FeatureTypeStyle>' +
                        '<Rule>' +
                            '<ogc:Filter>' +
                                '<ogc:And>' +
                                    filters + 
                                '</ogc:And>' +
                            '</ogc:Filter>' +
                            '<PolygonSymbolizer>' +
                                '<Stroke>' +
                                    '<CssParameter name="stroke">' +
                                        '#42E9F5' +
                                    '</CssParameter>' +
                                    '<CssParameter name="stroke-width">' +
                                        (parseFloat(layerData['layerSymbology']['strokeSize']) + 2).toString() +
                                    '</CssParameter>' + 
                                '</Stroke>' +
                            '</PolygonSymbolizer>' +
                        '</Rule>' +
                    '</FeatureTypeStyle>';
                } else {
                    var filterRule = ''
                };
                switch (layerData['layerSymbology']['fillType']) {
                    case 'simple':
                        var sldRules = '<Rule>' +
                            '<PolygonSymbolizer>' +
                                '<Fill>' +
                                    '<CssParameter name="fill">' +
                                        layerData['layerSymbology']['fillColor'] +
                                    '</CssParameter>' +
                                    '<CssParameter name="fill-opacity">' +
                                        layerData['layerSymbology']['fillOpacity'] +
                                    '</CssParameter>' +
                                '</Fill>' +
                                '<Stroke>' +
                                    '<CssParameter name="stroke">' +
                                        layerData['layerSymbology']['strokeColor'] +
                                    '</CssParameter>' +
                                    '<CssParameter name="stroke-opacity">' +
                                        layerData['layerSymbology']['strokeOpacity'] +
                                    '</CssParameter>' + 
                                    '<CssParameter name="stroke-width">' +
                                        layerData['layerSymbology']['strokeSize'] +
                                    '</CssParameter>' + 
                                '</Stroke>' +
                            '</PolygonSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'gradient':
                        var fieldStats = layerData['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldStats'];
                        if (fieldStats === null) {
                            layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldStats'] = 'loading';
                            getFieldStats(
                                layerList[activeLayer]['layerType'], 
                                layerList[activeLayer]['layerCode'], 
                                layerList[activeLayer]['resourceId'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldName'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldType']
                            );
                            sldRules = '';
                        } else if (fieldStats === 'loading') {
                            sldRules = '';
                        } else {
                            var colormap = getColorMap(layerData['layerSymbology']['fillGradient'], fieldStats);
                            var gradValue = '';
                            for (var i = 0; i < colormap['positions'].length; i++) {
                                gradValue = gradValue + 
                                    '<ogc:Literal>' + colormap['positions'][i] + '</ogc:Literal>' +
                                    '<ogc:Literal>' + colormap['colors'][i] + '</ogc:Literal>'
                            };
                            var sldRules = '<Rule>' +
                                '<PolygonSymbolizer>' +
                                    '<Fill>' +
                                        '<CssParameter name="fill">' +
                                            '<ogc:Function name="Interpolate">' +
                                                '<ogc:PropertyName>' + layerData['layerSymbology']['fillField'] +'</ogc:PropertyName>' +
                                                gradValue +
                                                '<ogc:Literal>color</ogc:Literal>' +
                                            '</ogc:Function>' +
                                        '</CssParameter>' +
                                        '<CssParameter name="fill-opacity">' +
                                            layerData['layerSymbology']['fillOpacity'] +
                                        '</CssParameter>' +
                                    '</Fill>' +
                                    '<Stroke>' +
                                        '<CssParameter name="stroke">' +
                                            layerData['layerSymbology']['strokeColor'] +
                                        '</CssParameter>' +
                                        '<CssParameter name="stroke-opacity">' +
                                            layerData['layerSymbology']['strokeOpacity'] +
                                        '</CssParameter>' + 
                                        '<CssParameter name="stroke-width">' +
                                            layerData['layerSymbology']['strokeSize'] +
                                        '</CssParameter>' + 
                                    '</Stroke>' +
                                '</PolygonSymbolizer>' +
                            '</Rule>';
                        };
                        break;
                };
                break;
            case 'raster':
                var filterRule = ''
                switch (layerData['layerSymbology']['fillType']) {
                    case 'gradient':
                        var fieldStats = layerData['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldStats'];
                        if (fieldStats === null) {
                            layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldStats'] = 'loading';
                            getFieldStats(
                                layerList[activeLayer]['layerType'], 
                                layerList[activeLayer]['layerCode'], 
                                layerList[activeLayer]['resourceId'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldName'],
                                layerList[activeLayer]['layerFields'][layerData['layerFields'].findIndex(x => x.fieldName === layerData['layerSymbology']['fillField'])]['fieldType']
                            );
                            sldRules = '';
                        } else if (fieldStats === 'loading') {
                            sldRules = '';
                        } else {
                            var colormap = getColorMap(layerData['layerSymbology']['fillGradient'], fieldStats);
                            var gradValue = '';
                            for (var i = 0; i < colormap['positions'].length; i++) {
                                gradValue = gradValue + '<ColorMapEntry color="' + colormap['colors'][i] + '" quantity="' + colormap['positions'][i] + '" />';
                            };
                            var sldRules = '<Rule>' +
                                '<RasterSymbolizer>' +
                                    '<Opacity>' + layerData['layerSymbology']['fillOpacity'] + '</Opacity>' +
                                    '<ColorMap>' +
                                        gradValue +
                                    '</ColorMap>' +
                                '</RasterSymbolizer>' +
                            '</Rule>';
                        };
                        break;
                };
                break;
        };

        var sldString = '<?xml version="1.0" encoding="ISO-8859-1"?>' +
            '<StyledLayerDescriptor version="1.0.0" ' +
            'xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd" ' +
            'xmlns="http://www.opengis.net/sld" ' +
            'xmlns:ogc="http://www.opengis.net/ogc" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<NamedLayer>' +
                    '<Name>' + layerData['layerCode'] + '</Name>' +
                    '<UserStyle>' +
                        '<FeatureTypeStyle>' +
                        sldRules +
                        '</FeatureTypeStyle>' +
                        filterRule +
                        labelRule +
                    '</UserStyle>' +
                '</NamedLayer>' +
            '</StyledLayerDescriptor>';

        return sldString;
    };

    /* Updates symbology fields */
    function updateSymbologyFields() {
        $('.layer-option-container').hide();
        $('#fill-type-input').empty();
        $('#stroke-type-input').empty();
        $('#fill-field-input').empty();
        $('#stroke-field-input').empty();
        $('#label-field-input').empty();
        switch (layerList[activeLayer]['layerType']) {
            case 'timeseries':
            case 'point':
                $('#fill-type-option-container').show();
                $('#fill-type-input').append($("<option></option>").attr('value', 'simple').text('Simple'));
                if (layerList[activeLayer]['layerFields'].map(x => x['fieldType']).includes('numerical')) {
                    $('#fill-type-input').append($("<option></option>").attr('value', 'gradient').text('Gradient'));
                };
                $('#fill-type-input').val(layerList[activeLayer]['layerSymbology']['fillType']);
                symbologyColorPicker('#fill-color-selector', layerList[activeLayer]['layerSymbology']['fillColor']);
                $('#fill-opacity-input').val(layerList[activeLayer]['layerSymbology']['fillOpacity']);
                $('#fill-size-input').val(layerList[activeLayer]['layerSymbology']['fillSize']);
                $('#fill-shape-input').val(layerList[activeLayer]['layerSymbology']['fillShape']);
                $('#fill-gradient-input').val(layerList[activeLayer]['layerSymbology']['fillGradient']);
                for (var i = 0; i < layerList[activeLayer]['layerFields'].length; i++) {
                    if (layerList[activeLayer]['layerFields'][i]['fieldType'] === 'numerical') {
                        $('#fill-field-input').append($("<option></option>").attr('value', layerList[activeLayer]['layerFields'][i]['fieldName']).text(layerList[activeLayer]['layerFields'][i]['fieldName']));
                    };
                };
                $('#fill-field-input').val(layerList[activeLayer]['layerSymbology']['fillField']);
                switch (layerList[activeLayer]['layerSymbology']['fillType']) {
                    case 'simple':
                        $('#fill-color-option-container').show();
                        $('#fill-opacity-option-container').show();
                        $('#fill-size-option-container').show();
                        $('#fill-shape-option-container').show();
                        break;
                    case 'gradient':
                        $('#fill-field-option-container').show();
                        $('#fill-gradient-option-container').show();
                        $('#fill-opacity-option-container').show();
                        $('#fill-size-option-container').show();
                        $('#fill-shape-option-container').show();
                        break;
                };
                $('#stroke-color-option-container').show();
                symbologyColorPicker('#stroke-color-selector', layerList[activeLayer]['layerSymbology']['strokeColor']);
                $('#stroke-opacity-option-container').show();
                $('#stroke-opacity-input').val(layerList[activeLayer]['layerSymbology']['strokeOpacity']);
                $('#stroke-size-option-container').show();
                $('#stroke-size-input').val(layerList[activeLayer]['layerSymbology']['strokeSize']);
                setupLabelFields();
                break;
            case 'line':
                $('#stroke-type-option-container').show();
                $('#stroke-type-input').append($("<option></option>").attr('value', 'simple').text('Simple'));
                if (layerList[activeLayer]['layerFields'].map(x => x['fieldType']).includes('numerical')) {
                    $('#stroke-type-input').append($("<option></option>").attr('value', 'gradient').text('Gradient'));
                };
                $('#stroke-type-input').val(layerList[activeLayer]['layerSymbology']['strokeType']);
                symbologyColorPicker('#stroke-color-selector', layerList[activeLayer]['layerSymbology']['strokeColor']);
                $('#stroke-opacity-input').val(layerList[activeLayer]['layerSymbology']['strokeOpacity']);
                $('#stroke-size-input').val(layerList[activeLayer]['layerSymbology']['strokeSize']);
                $('#stroke-gradient-input').val(layerList[activeLayer]['layerSymbology']['strokeGradient']);
                for (var i = 0; i < layerList[activeLayer]['layerFields'].length; i++) {
                    if (layerList[activeLayer]['layerFields'][i]['fieldType'] === 'numerical') {
                        $('#stroke-field-input').append($("<option></option>").attr('value', layerList[activeLayer]['layerFields'][i]['fieldName']).text(layerList[activeLayer]['layerFields'][i]['fieldName']));
                    };
                };
                $('#stroke-field-input').val(layerList[activeLayer]['layerSymbology']['strokeField']);
                switch (layerList[activeLayer]['layerSymbology']['strokeType']) {
                    case 'simple':
                        $('#stroke-color-option-container').show();
                        $('#stroke-opacity-option-container').show();
                        $('#stroke-size-option-container').show();
                        break;
                    case 'gradient':
                        $('#stroke-field-option-container').show();
                        $('#stroke-gradient-option-container').show();
                        $('#stroke-opacity-option-container').show();
                        $('#stroke-size-option-container').show();
                        break;
                };
                setupLabelFields();
                break;
            case 'polygon':
                $('#fill-type-option-container').show();
                $('#fill-type-input').append($("<option></option>").attr('value', 'simple').text('Simple'));
                if (layerList[activeLayer]['layerFields'].map(x => x['fieldType']).includes('numerical')) {
                    $('#fill-type-input').append($("<option></option>").attr('value', 'gradient').text('Gradient'));
                };
                $('#fill-type-input').val(layerList[activeLayer]['layerSymbology']['fillType']);
                symbologyColorPicker('#fill-color-selector', layerList[activeLayer]['layerSymbology']['fillColor']);
                $('#fill-opacity-input').val(layerList[activeLayer]['layerSymbology']['fillOpacity']);
                $('#fill-gradient-input').val(layerList[activeLayer]['layerSymbology']['fillGradient']);
                for (var i = 0; i < layerList[activeLayer]['layerFields'].length; i++) {
                    if (layerList[activeLayer]['layerFields'][i]['fieldType'] === 'numerical') {
                        $('#fill-field-input').append($("<option></option>").attr('value', layerList[activeLayer]['layerFields'][i]['fieldName']).text(layerList[activeLayer]['layerFields'][i]['fieldName']));
                    };
                };
                $('#fill-field-input').val(layerList[activeLayer]['layerSymbology']['fillField']);
                switch (layerList[activeLayer]['layerSymbology']['fillType']) {
                    case 'simple':
                        $('#fill-color-option-container').show();
                        $('#fill-opacity-option-container').show();
                        break;
                    case 'gradient':
                        $('#fill-field-option-container').show();
                        $('#fill-gradient-option-container').show();
                        $('#fill-opacity-option-container').show();
                        break;
                };
                $('#stroke-color-option-container').show();
                symbologyColorPicker('#stroke-color-selector', layerList[activeLayer]['layerSymbology']['strokeColor']);
                $('#stroke-opacity-option-container').show();
                $('#stroke-opacity-input').val(layerList[activeLayer]['layerSymbology']['strokeOpacity']);
                $('#stroke-size-option-container').show();
                $('#stroke-size-input').val(layerList[activeLayer]['layerSymbology']['strokeSize']);
                setupLabelFields();
                break;
            case 'raster':
                $('#fill-gradient-input').val(layerList[activeLayer]['layerSymbology']['fillGradient']);
                $('#fill-opacity-input').val(layerList[activeLayer]['layerSymbology']['fillOpacity']);
                switch (layerList[activeLayer]['layerSymbology']['fillType']) {
                    case 'gradient':
                        $('#fill-gradient-option-container').show();
                        $('#fill-opacity-option-container').show();
                        break;
                };
                break;
        };
    };

    /* Gets colormap for raster and attribute styling */
    function getColorMap(colorMap, fieldStats) {
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
            positions.push(fieldStats['min'] + colorMaps[colorMap]['positions'][i] * (fieldStats['max'] - fieldStats['min']))
        };
        return {
            'colors': colorMaps[colorMap]['colors'],
            'positions': positions
        };
    };

    /* Creates SVG Icon for Layer */
    function createLayerIcon(layerCode) {
        var layerType = layerList[layerCode]['layerType'];
        var fillShape = layerList[layerCode]['layerSymbology']['fillShape'];
        var fillGradient = layerList[layerCode]['layerSymbology']['fillGradient'];
        var fillType = layerList[layerCode]['layerSymbology']['fillType'];
        var fillOpacity = layerList[layerCode]['layerSymbology']['fillOpacity'];
        var fillColor = layerList[layerCode]['layerSymbology']['fillColor'];
        var fillField = layerList[layerCode]['layerSymbology']['fillField'];
        var strokeType = layerList[layerCode]['layerSymbology']['strokeType'];
        var strokeColor = layerList[layerCode]['layerSymbology']['strokeColor'];
        var strokeOpacity = layerList[layerCode]['layerSymbology']['strokeOpacity'];
        var strokeField = layerList[layerCode]['layerSymbology']['strokeField'];
        var strokeGradient = layerList[layerCode]['layerSymbology']['strokeGradient'];
        var gradientCode = Math.random().toString(36).substring(7);

        switch (layerType) {
            case 'timeseries':
            case 'point':
                switch (fillType) {
                    case 'simple':
                        var def = ``;
                        var fill = `fill:${fillColor}`;
                        break;
                    case 'gradient':
                        var fillField = layerList[layerCode]['layerSymbology']['fillField'];
                        var fieldStats = layerList[layerCode]['layerFields'][layerList[layerCode]['layerFields'].findIndex(x => x.fieldName === fillField)]['fieldStats'];
                        if (fieldStats === 'loading' || fieldStats === null) {
                            return '<img class="workspace-loading-icon" src="/static/hydroshare_data_viewer/images/spinner.gif">';
                        };
                        var colorMap = getColorMap(fillGradient, fieldStats);
                        var svgGradient = ``;
                        for (var i = 0; i < colorMap['colors'].length; i++) { 
                            svgGradient = svgGradient + `<stop offset="${(((colorMap['positions'][i] - fieldStats['min']) / (fieldStats['max'] - fieldStats['min'])) * 100).toString()}%" style="stop-color:${colorMap['colors'][i]};stop-opacity:1" />`
                        };
                        var def = `<defs>
                                <linearGradient id="${'grad-' + gradientCode}" x1="0%" y1="0%" x2="100%" y2="0%">
                                    ${svgGradient}
                                </linearGradient>
                            </defs>`;
                        var fill = `fill:url(#${'grad-' + gradientCode})`;
                        break;
                };
                switch (fillShape) {
                    case 'circle':
                        var layerIcon = `
                            <svg height="24" width="24" style="display: block;">
                                ${def}
                                <circle class="workspace-icon" cx="12" cy="12" r="7" fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" style="${fill};stroke:${strokeColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'square':
                        var layerIcon = `
                            <svg height="24" width="24" style="display: block;">
                                ${def}
                                <polygon class="workspace-icon" points="5 18, 18 18, 18 5, 5 5" fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" style="${fill};stroke:${strokeColor};stroke-width:2" />
                            </svg>
                        `;
                        break;
                    case 'triangle':
                        var layerIcon = `
                            <svg height="24" width="24" style="display: block;">
                                ${def}
                                <polygon class="workspace-icon" points="5 18, 19 18, 12 6" fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" style="${fill};stroke:${strokeColor};stroke-width:2"/>
                            </svg>
                        `;
                        break;
                };
                break;
            case 'line':
                switch (strokeType) {
                    case 'simple':
                        var def = ``;
                        var stroke = `stroke:${strokeColor}`;
                        break;
                    case 'gradient':
                        var strokeField = layerList[layerCode]['layerSymbology']['strokeField'];
                        var fieldStats = layerList[layerCode]['layerFields'][layerList[layerCode]['layerFields'].findIndex(x => x.fieldName === strokeField)]['fieldStats'];
                        if (fieldStats === 'loading' || fieldStats === null) {
                            return '<img class="workspace-loading-icon" src="/static/hydroshare_data_viewer/images/spinner.gif">';
                        };
                        var colorMap = getColorMap(strokeGradient, fieldStats);
                        var svgGradient = ``;
                        for (var i = 0; i < colorMap['colors'].length; i++) { 
                            svgGradient = svgGradient + `<stop offset="${(((colorMap['positions'][i] - fieldStats['min']) / (fieldStats['max'] - fieldStats['min'])) * 100).toString()}%" style="stop-color:${colorMap['colors'][i]};stop-opacity:1" />`
                        };
                        var def = `<defs>
                                <linearGradient id="${'grad-' + gradientCode}" x1="0%" y1="0%" x2="100%" y2="0%">
                                    ${svgGradient}
                                </linearGradient>
                            </defs>`;
                        var stroke = `stroke:url(#${'grad-' + gradientCode})`;
                        break;
                };
                var layerIcon = `
                    <svg height="24" width="24" style="display: block;">
                        ${def}
                        <polyline class="workspace-icon" points="1,23 20,18 5,7 23,1" fill-opacity="${strokeOpacity}" style="fill:none;${stroke};stroke-width:2" />
                    </svg>
                `;
                break;
            case 'polygon':
                switch (fillType) {
                    case 'simple':
                        var def = ``;
                        var fill = `fill:${fillColor}`;
                        break;
                    case 'gradient':
                        var fillField = layerList[layerCode]['layerSymbology']['fillField'];
                        var fieldStats = layerList[layerCode]['layerFields'][layerList[layerCode]['layerFields'].findIndex(x => x.fieldName === fillField)]['fieldStats'];
                        if (fieldStats === 'loading' || fieldStats === null) {
                            return '<img class="workspace-loading-icon" src="/static/hydroshare_data_viewer/images/spinner.gif">';
                        };
                        var colorMap = getColorMap(fillGradient, fieldStats);
                        var svgGradient = ``;
                        for (var i = 0; i < colorMap['colors'].length; i++) { 
                            svgGradient = svgGradient + `<stop offset="${(((colorMap['positions'][i] - fieldStats['min']) / (fieldStats['max'] - fieldStats['min'])) * 100).toString()}%" style="stop-color:${colorMap['colors'][i]};stop-opacity:1" />`
                        };
                        var def = `<defs>
                                <linearGradient id="${'grad-' + gradientCode}" x1="0%" y1="0%" x2="100%" y2="0%">
                                    ${svgGradient}
                                </linearGradient>
                            </defs>`;
                        var fill = `fill:url(#${'grad-' + gradientCode})`;
                        break;
                };
                var layerIcon = `
                    <svg height="24" width="24" style="display: block;">
                        ${def}
                        <polygon class="workspace-icon" points="1,23 5,5 20,1 23,20" fill-opacity="${fillOpacity}" stroke-opacity="${strokeOpacity}" style="${fill};stroke:${strokeColor};stroke-width:2" />
                    </svg>
                `;
                break;
            case 'raster':
                switch (fillType) {
                    case 'simple':
                        var def = ``;
                        var fill = `${fillColor}`;
                        break;
                    case 'gradient':
                        var fillField = layerList[layerCode]['layerSymbology']['fillField'];
                        var fieldStats = layerList[layerCode]['layerFields'][layerList[layerCode]['layerFields'].findIndex(x => x.fieldName === fillField)]['fieldStats'];
                        if (fieldStats === 'loading' || fieldStats === null) {
                            return '<img class="workspace-loading-icon" src="/static/hydroshare_data_viewer/images/spinner.gif">';
                        };
                        var colorMap = getColorMap(fillGradient, fieldStats);
                        var svgGradient = ``;
                        for (var i = 0; i < colorMap['colors'].length; i++) { 
                            svgGradient = svgGradient + `<stop offset="${(((colorMap['positions'][i] - fieldStats['min']) / (fieldStats['max'] - fieldStats['min'])) * 100).toString()}%" style="stop-color:${colorMap['colors'][i]};stop-opacity:1" />`
                        };
                        var def = `<defs>
                                <linearGradient id="${'grad-' + gradientCode}" x1="0%" y1="0%" x2="100%" y2="0%">
                                    ${svgGradient}
                                </linearGradient>
                            </defs>`;
                        var fill = `url(#${'grad-' + gradientCode})`;
                        break;
                };
                var layerIcon = `
                    <svg height="24" width="24" style="display: block;">
                        ${def}
                        <rect class="workspace-icon" width="24" height="24" fill="${fill}" />
                    </svg>
                `;
                break;
        };
        return layerIcon;
    };

    /* Loads HydroShare Resource Data */
    function loadHydroShareData(resourceId) {
        activeResource = resourceId;
        getResourceMetadata(true, true);
    };

    /* Initializes color picker for layer symbology */
    function symbologyColorPicker(element, defaultColor) {
        $(element).spectrum({
            color: defaultColor,
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
            showAlpha: false,
            hide: function(color) {
                updateLayerSymbology(null);
            }
        });
    };

    /* Changes Layer Symbology */
    function updateLayerSymbology(force) {
        var sldBodyOld = buildLayerStyle(layerList[activeLayer]);
        switch (layerList[activeLayer]['layerType']) {
            case 'timeseries':
            case 'point':
                layerList[activeLayer]['layerSymbology']['fillType'] = $('#fill-type-input').val();
                layerList[activeLayer]['layerSymbology']['fillShape'] = $('#fill-shape-input').val();
                layerList[activeLayer]['layerSymbology']['fillSize'] = $('#fill-size-input').val();
                layerList[activeLayer]['layerSymbology']['fillColor'] = $('#fill-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['fillOpacity'] = $('#fill-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['fillField'] = $('#fill-field-input').val();
                layerList[activeLayer]['layerSymbology']['fillGradient'] = $('#fill-gradient-input').val();
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#stroke-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#stroke-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['strokeSize'] = $('#stroke-size-input').val();
                layerList[activeLayer]['layerSymbology']['labelField'] = $('#label-field-input').val();
                layerList[activeLayer]['layerSymbology']['labelColor'] = $('#label-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['labelOpacity'] = $('#label-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['labelSize'] = $('#label-size-input').val();
                layerList[activeLayer]['layerSymbology']['labelFont'] = $('#label-font-input').val();
                break;
            case 'line':
                layerList[activeLayer]['layerSymbology']['strokeType'] = $('#stroke-type-input').val();
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#stroke-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#stroke-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['strokeSize'] = $('#stroke-size-input').val();
                layerList[activeLayer]['layerSymbology']['strokeGradient'] = $('#stroke-gradient-input').val();
                layerList[activeLayer]['layerSymbology']['strokeField'] = $('#stroke-field-input').val();
                layerList[activeLayer]['layerSymbology']['labelField'] = $('#label-field-input').val();
                layerList[activeLayer]['layerSymbology']['labelColor'] = $('#label-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['labelOpacity'] = $('#label-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['labelSize'] = $('#label-size-input').val();
                layerList[activeLayer]['layerSymbology']['labelFont'] = $('#label-font-input').val();
                break;
            case 'polygon':
                layerList[activeLayer]['layerSymbology']['fillType'] = $('#fill-type-input').val();
                layerList[activeLayer]['layerSymbology']['fillColor'] = $('#fill-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['fillOpacity'] = $('#fill-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['fillField'] = $('#fill-field-input').val();
                layerList[activeLayer]['layerSymbology']['fillGradient'] = $('#fill-gradient-input').val();
                layerList[activeLayer]['layerSymbology']['strokeColor'] = $('#stroke-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['strokeOpacity'] = $('#stroke-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['strokeSize'] = $('#stroke-size-input').val();
                layerList[activeLayer]['layerSymbology']['labelField'] = $('#label-field-input').val();
                layerList[activeLayer]['layerSymbology']['labelColor'] = $('#label-color-selector').spectrum('get').toHexString();
                layerList[activeLayer]['layerSymbology']['labelOpacity'] = $('#label-opacity-input').val();
                layerList[activeLayer]['layerSymbology']['labelSize'] = $('#label-size-input').val();
                layerList[activeLayer]['layerSymbology']['labelFont'] = $('#label-font-input').val();
                break;
            case 'raster':
                layerList[activeLayer]['layerSymbology']['fillGradient'] = $('#fill-gradient-input').val();
                layerList[activeLayer]['layerSymbology']['fillGradientName'] = $('#fill-gradient-input').val();
                layerList[activeLayer]['layerSymbology']['fillOpacity'] = $('#fill-opacity-input').val();
                break;
        };
        var sldBody = buildLayerStyle(layerList[activeLayer]);
        if (sldBodyOld !== sldBody || force === true) {
            layerList[activeLayer]['layerWMS'].updateParams({'SLD_BODY': sldBody});
        };
        updateSymbologyFields();
    };

    /* Sets up label fields */
    function setupLabelFields() {
        $('#label-field-option-container').show();
        $('#label-field-input').append($("<option></option>").attr('value', 'none').text('None'));
        for (var i = 0; i < layerList[activeLayer]['layerFields'].length; i++) {
            $('#label-field-input').append($("<option></option>").attr('value', layerList[activeLayer]['layerFields'][i]['fieldName']).text(layerList[activeLayer]['layerFields'][i]['fieldName']));
        };
        $('#label-field-input').val(layerList[activeLayer]['layerSymbology']['labelField']);
        $('#label-color-option-container').show();
        symbologyColorPicker('#label-color-selector', layerList[activeLayer]['layerSymbology']['labelColor']);
        $('#label-opacity-option-container').show();
        $('#label-opacity-input').val(layerList[activeLayer]['layerSymbology']['labelOpacity']);
        $('#label-size-option-container').show();
        $('#label-size-input').val(layerList[activeLayer]['layerSymbology']['labelSize']);
        $('#label-font-option-container').show();
        $('#label-font-input').val(layerList[activeLayer]['layerSymbology']['labelFont']);
    };

    /* Sets up Attribute Table for Layer */
    function buildAttributeTable() {

        // Remove existing table
        try {
            attributeTable.destroy();
            $('#attr-table-container').empty();
        } catch {};

        // Setup table columns
        $('#attr-table-container').append('<table id="attribute-table" class="display"></table>');
        $('#attribute-table').append("<thead><tr></tr></thead>");
        $('#attribute-table>thead>tr').append('<th>Feature</th>');
        var layerFields = [];
        for (var i = 0; i < layerList[activeLayer]['layerFields'].length; i++) {
            layerFields.push(layerList[activeLayer]['layerFields'][i]['fieldName']);
            $('#attribute-table>thead>tr').append(`<th>${layerList[activeLayer]['layerFields'][i]['fieldName']}</th>`);
        };

        // Initializes Discover Table
        attributeTable = $('#attribute-table').DataTable({
            'select': {
                'style': 'single'
            },
            'serverSide': true,
            'lengthChange': false,
            'sort': false,
            'ajax': {
                'url': '/apps/hydroshare-data-viewer/ajax/update-attribute-table/',
                'type': 'POST',
                'data': {
                    'layer_fields': layerFields,
                    'layer_code': activeLayer
                },
                'headers': {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            },
            'drawCallback': function() {
                $('.dataTables_scrollHeadInner').css({'width':'100%'});
            },
            'deferRender': true,
            'scrollY': 209,
            'scrollX': '100%',
            'language': {
                'loadingRecords': '<div class="main-loading-container"><img class="main-loading-animation attr-loading" src="/static/hydroshare_data_viewer/images/grid.svg"></div>',
                'processing': '<div class="main-loading-container"><img class="main-loading-animation attr-loading" src="/static/hydroshare_data_viewer/images/grid.svg"></div>'
            },
            'scroller': {
                'loadingIndicator': true,
                'displayBuffer': 20,
                'rowHeight': 37
            },
            'drawCallback': function() {
                attributeTable.rows().eq(0).each(function(index){
                    var row = attributeTable.row(index);
                    var data = row.data();
                    if (data[0] === selectedLayer['feature']) {
                        row.select();
                    };
                });
            },
        });

        // Adds event listeners to Discover Table
        attributeTable.on('select', selectFeature);
        attributeTable.on('deselect', selectFeature);
    };

    /* Sets up plot viewer */
    function buildPlot() {
        $('#plot-loading').show();
        $('#plot-container').hide();
        $('#ts-plot').removeClass('disabled-tab');
        try {
            timeseriesPlot.destory();
        } catch {};
        $.ajax({
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            type: 'POST',
            data: {
                'layer_code': activeLayer,
                'site_code': selectedLayer['row'][1],
                'var_code': selectedLayer['row'][3],
                'site_name': selectedLayer['row'][0],
                'var_name': selectedLayer['row'][2]
            },
            url: '/apps/hydroshare-data-viewer/ajax/get-timeseries-data/',
            success: function(response) {
                var timeseriesData = [];
                for (var i = 0; i < response['timeseries_data'].length; i++) {
                    timeseriesData.push({
                        'x': Date.parse(response['timeseries_data'][i][0]),
                        'y': parseFloat(response['timeseries_data'][i][1])
                    })
                };
                timeseriesPlot = new CanvasJS.Chart('plot', {
                    height: 250,
                    responsive: true,
                    animationEnabled: true,
                    zoomEnabled: true,
                    title: {
                        text: response['variable_name'] + ' at ' + response['site_name']
                    },
                    axisX: {},
                    axisY: {
                        title: response['variable_name'] + ' (' + response['unit_name'] + ')',
                    },
                    data: [{
                        type:'line',
                        name: response['variable_name'],
                        xValueType: 'dateTime',
                        xValueFormatString: 'DD MMM hh:mm TT',
                        dataPoints: timeseriesData
                    }]
                });
                $('#plot-loading').hide();
                $('#plot-container').show();
                updateMapSize();
            },
            error: function(response) {
                console.log('Layer Load Failed');
            }
        });
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

    /*****************************************************************************************
     ************************************** LISTENERS ****************************************
     *****************************************************************************************/

    /* Listener for initializing app */
    $(document).ready(initApp);

    /* Listener for updating window size */
    $(window).resize(resizeWindow);

    /* Listener for updating basemap */
    $(document).on('change', '.basemap-radio', updateBasemap);

    /* Listener for toggling nav tabs */
    $(document).on('click', '.nav-tab-button', toggleNavTabs);

    /* Listener for updating map size on nav toggle */
    $(document).on('click', '.toggle-nav', updateMapSize);

    /* Listener for changing data viewer tabs */
    $(document).on('click', '.data-viewer-tab', changeDataViewerTab);

    /* Listener for collapsing data viewer */
    $(document).on('click', '#data-viewer-show', showDataViewer);

    /* Listener for collapsing data viewer */
    $(document).on('click', '#data-viewer-hide', hideDataViewer);

    /* Listener for adding a layer from resource tab */
    $(document).on('click', '.resource-aggregation-add', dataViewerAddLayer);

    /* Listener for editing a layer from resource tab */
    $(document).on('click', '.resource-aggregation-edit', dataViewerEditLayer);

    /* Listener for zooming to layer */
    $(document).on('click', '#zoom-to-layer-btn', zoomToLayer);

    /* Listener for changing layer symbology */
    $(document).on('change', '.symbology-input', updateLayerSymbology);

    /* Listener for changing slider value */
    $(document).on('change', '.symbology-slider', updateSlider);

    /* Listener for hiding layer */
    $(document).on('click', '#hide-layer-btn', toggleLayer);

    /* Listener for showing layer */
    $(document).on('click', '#show-layer-btn', toggleLayer);

    /* Listener for removing layer */
    $(document).on('click', '#remove-layer-confirm-btn', removeLayer);

    /* Listener for renaming layer */
    $(document).on('click', '#edit-layer-name-confirm-btn', renameLayer);

    /* Listener for canceling layer rename */
    $(document).on('hidden.bs.modal', '#edit-layer-name-modal', cancelRenameLayer);

    /* Listener for searching discover table on button click */
    $(document).on('keyup', '#discover-input', searchDiscoverTable);

}());
