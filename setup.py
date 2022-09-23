from setuptools import setup, find_namespace_packages
from tethys_apps.app_installation import find_resource_files

# -- Apps Definition -- #
app_package = 'hydroshare_data_viewer'
release_package = 'tethysapp-' + app_package

# -- Python Dependencies -- #
dependencies = []

# -- Get Resource File -- #
resource_files = find_resource_files('tethysapp/' + app_package + '/templates', 'tethysapp/' + app_package)
resource_files += find_resource_files('tethysapp/' + app_package + '/public', 'tethysapp/' + app_package)
resource_files += find_resource_files('tethysapp/' + app_package + '/workspaces', 'tethysapp/' + app_package)

setup(
    name=release_package,
    version='0.0.1',
    description='This app is designed to run on Tethys Platform and helps support CUAHSI\'s HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.',
    long_description='This app is designed to run on Tethys Platform and helps support CUAHSI\'s HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.',
    keywords='',
    author='Ken Lippold',
    author_email='kjlippold@gmail.com',
    url='https://hs-apps-dev.hydroshare.org/apps/hydroshare-data-viewer/',
    license='MIT',
    packages=find_namespace_packages(),
    package_data={'': resource_files},
    include_package_data=True,
    zip_safe=False,
    install_requires=dependencies,
)
