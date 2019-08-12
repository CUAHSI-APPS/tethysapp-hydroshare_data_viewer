# HydroShare GIS Data Viewer

This app is designed to run on Tethys Platform and helps support CUAHSI's HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.

## Getting Started

These instructions will help you install and run this app in a Tethys Platform development environment.

### Prerequisites

##### Tethys Platform (Version 2.1.0 [Python 3] or later):
* [Linux and macOS](http://docs.tethysplatform.org/en/stable/installation/linux_and_mac.html)
* [Windows](http://docs.tethysplatform.org/en/stable/installation/windows.html)

##### HydroShare OAuth Backend:
* [HydroShare Social Authentication](http://docs.tethysplatform.org/en/stable/tethys_portal/social_auth.html#hydroshare)

### Installing

Activate the Tethys conda environment:
```
$ t
```

Clone this repository into your Tethys apps folder:
```
$ git clone https://github.com/kjlippold/tethysapp-hydroshare_gis_data_viewer.git
```

Enter the app folder:
```
$ cd /tethysapp-hydroshare_gis_data_viewer
```

Install the app:
```
$ python setup.py develop
```

Use the [Tethys Portal Admin Console](http://docs.tethysplatform.org/en/stable/installation/web_admin_setup.html) to define custom settings for the app. The HydroShare URL should point to the instance of HydroShare you wish to connect to (e.g. https://www.hydroshare.org). The GeoServer URL should point to a GeoServer associated with that instance of HydroShare (e.g. https://geoserver.hydroshare.org/geoserver). The HydroServer URL should point to a HydroServer associated with that instance of HydroShare (e.g. https://geoserver.hydroshare.org/wds). The Maximum Layer Count setting should be an integer that will limit the total number of layers a user can load into the app at once.

The HydroShare Time Series Manager should now be running in you Tethys Portal.

## Built With

* [Tethys Platform](http://www.tethysplatform.org) - Web Application Framework
* [HydroShare](https://www.hydroshare.org/) - Hydrologic Information System

## License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details