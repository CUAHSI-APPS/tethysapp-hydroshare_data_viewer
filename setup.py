import os
import sys
from setuptools import setup, find_packages
from tethys_apps.app_installation import custom_develop_command, custom_install_command

# -- Apps Definition -- #
app_package = 'hydroshare_data_viewer'
release_package = 'tethysapp-' + app_package
app_class = 'hydroshare_data_viewer.app:HydroshareDataViewer'
app_package_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tethysapp', app_package)

# -- Python Dependencies -- #
dependencies = []

setup(
    name=release_package,
    version='1.0',
    tags='',
    description='This app is designed to run on Tethys Platform and helps support CUAHSI\'s HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.',
    long_description='This app is designed to run on Tethys Platform and helps support CUAHSI\'s HydroShare project. Its purpose is to allow HydroShare users to quickly preview hydrologic geospatial and time series content stored in HydroShare resources.',
    keywords='',
    author='Ken Lippold',
    author_email='kjlippold@gmail.com',
    url='https://hs-apps-dev.hydroshare.org/apps/hydroshare-data-viewer/',
    license='MIT',
    packages=find_packages(exclude=['ez_setup', 'examples', 'tests']),
    namespace_packages=['tethysapp', 'tethysapp.' + app_package],
    include_package_data=True,
    zip_safe=False,
    install_requires=dependencies,
    cmdclass={
        'install': custom_install_command(app_package, app_package_dir, dependencies),
        'develop': custom_develop_command(app_package, app_package_dir, dependencies)
    }
)
