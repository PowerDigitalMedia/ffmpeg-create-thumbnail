
# FFMpeg - Create Thumbnail


## Description

Multi function document that creates a thumbnail from a video using FFMpeg. After the create action the thumbnail is uploaded to Amazon S3 bucket. 



#### `( FUNCTION: handler )`

* handles initilizing and completion of tasks

#### `( FUNCTION: flow )`

* async function that controls the procesing of functions


#### `( FUNCTION: Create_Image )`

* creates an image to a temporary location


#### `( FUNCTION: Image_To_S3 )`

* moves image from temporary location to S3 bucket


