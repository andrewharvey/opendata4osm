#!/bin/sh

# input
# https://www.data.brisbane.qld.gov.au/data/dataset/park-facilities-and-assets/resource/66b3c6ce-4731-4b19-bddd-8736e3111f7e
#
# output
# "park-facilities-and-assets": {
#    "resource": "66b3c6ce-4731-4b19-bddd-8736e3111f7e"
# },


sed 's/.*dataset\///' | sed 's/^/"/' | sed 's/$/"\n},/' | sed 's/\/resource\//": {\n    "resource": "/'
