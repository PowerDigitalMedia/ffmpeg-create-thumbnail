//#######################################
//#######################################

const AWS = require('aws-sdk')
const { spawn, spawnSync } = require('child_process')
const { createReadStream, createWriteStream } = require('fs')
const fs = require('fs')



//#######################################
//#######################################

const s3 = new AWS.S3()

const ffprobePath = '/opt/bin/ffprobe'
const ffmpegPath = '/opt/bin/ffmpeg'

//const allowedTypes = ['mov', 'mpg', 'mpeg', 'mp4', 'wmv', 'avi', 'webm']
const allowedTypes = ['mp4']


const width = 1200;
const height = 800;







//########################################################################
//########################################################################
//########################################################################


module.exports.handler = async (event, context) => {


    let pack = {};
  

    if(event && event != undefined)
    {
        if(event.Records && event.Records != undefined)
        {
    

            const srcKey = decodeURIComponent(event.Records[0].s3.object.key).replace(/\+/g, ' ')
            const bucket = event.Records[0].s3.bucket.name

            const target = s3.getSignedUrl('getObject', { 

                Bucket: bucket, 
                Key: srcKey, 
                Expires: 1000 

            })

            pack["bucket"] = bucket; 
            pack["srcKey"] = srcKey;
            pack["target"] = target;
    

            var eventstuff = "Has Event";

        }else{

            var eventstuff = "No Event Records";

        }

    }
    else
    {
        var eventstuff = "No Event";

    }




	var result = await flow(pack);

  
	if(Object.prototype.toString.call(result) == "[object String]") var is_string = true;
	if(Object.prototype.toString.call(result) == "[object Array]") var is_array = true;
	if(Object.prototype.toString.call(result) == "[object Object]") var is_object = true;
	
	if(is_array || is_object)
	{
        console.log(JSON.stringify(result,null,2));
    }



    return result;
    


}//== export











//########################################################################
//########################################################################
//########################################################################


async function flow(pack) {

    try {
        


        let bucket      = pack['bucket']; 
        let srcKey      = pack['srcKey'];
        let target      = pack['target']; 
   
	
        //let ob = {};



        //=======================================
        //check filetype
        //=======================================

        var filetype_error = false;

        let fileType = srcKey.match(/\.\w+$/)

        if(!fileType) 
        {
            //throw new Error(`invalid file type found for key: ${srcKey}`)
            var filetype_error = `invalid file type found for key: ${srcKey}`


        }
    
        fileType = fileType[0].slice(1)
    
        if(allowedTypes.indexOf(fileType) === -1) 
        {
            //throw new Error(`filetype: ${fileType} is not an allowed type`)
            var filetype_error = `filetype: ${fileType} is not an allowed type`

        }




        //=======================================
        //verify and run
        //=======================================

        if(filetype_error)
        {

            //=========================================
            //finish
            //=========================================

            var result = {

                "pack":pack,
                "error":"File Type"

            };

            return result;


        }
        else
        {


            const ffprobe = spawnSync(ffprobePath, [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=nw=1:nk=1',
                target
            ])
    
            const duration = Math.ceil(ffprobe.stdout.toString())
        


            //=============================
            //a
            //=============================

            var a_create = await Create_Image({

                //"seek"      : duration * 0.25,
                "seek"      : 2,
                "target"    : target
            });


            if(!a_create['error'])
            {

                var a_to = await Image_To_S3({

                    "bucket"    : bucket,
                    "srcKey"    : srcKey,
                    "number"    : 1
                })

            }else{

                var a_to = {

                    "error":"skipped",
                    "result":""
                }

            }//==




            //=========================================
            //finish
            //=========================================

            var result = {

                "pack"      :pack,

                "a":{

                    "create" :a_create,
                    "to"     :a_to
                }


            };

            return result;

            //return console.log(`processed ${bucket}/${srcKey} successfully`)
        
        }//==


        
        
        
    }
    catch(error) {
        
        return error;
        
    }
  
}//async
//======




//########################################################################
//########################################################################
//########################################################################

function Create_Image(pack) {


    let seek = pack['seek'];
    let target = pack['target'];


    return new Promise((resolve) => {

        let tmpFile = createWriteStream(`/tmp/screenshot.jpg`)


        // CAPTURE ON FIRST FRAME

        const spwn = spawn(ffmpegPath, [

            '-i',
            target,
            '-vf',
            `thumbnail,scale=${width}:-2`,
            '-qscale:v',
            '2',
            '-frames:v',
            '1',
            '-f',
            'image2',
            '-c:v',  
            'mjpeg',
            'pipe:1'
        ])
        
        spwn.stdout.pipe(tmpFile)



        //=========================================

        spwn.on('close', function(exitCode) {

            tmpFile.end()

            var e = false;
            if(exitCode > 0 || exitCode == null) var e = "ERROR: FFmpeg Create Image";

            resolve({

                "error"     :e,
                "result"    :'FFmpeg (COMPLETE) (EXITCODE: '+exitCode+')'
            });
        })




        //===========================================

        spwn.on('error', function(err) {

            resolve({

                "error"     :err,
                "result"    :'FFmpeg (FAILED)'
            });

        })




        /*
        //===========================================
    
        spwn.stdout.on('data', function(data) {

            console.log(`stdout: ${data}`);

        });

        */



        //===========================================
      
        spwn.stderr.on('data', function(data) {

            console.log(`stderr: ${data}`);

        });

    

    })
    //promise
    //=======

}//function
//=========


















//########################################################################
//########################################################################
//########################################################################




function Image_To_S3(pack) {


    let bucket = pack['bucket'];
    let srcKey = pack['srcKey'];
    let number = pack['number'];


    return new Promise((resolve) => {


        let tmpFile = createReadStream(`/tmp/screenshot.jpg`)

        //let dstKey = srcKey.replace(/\.\w+$/, `-${number}.jpg`).replace('/videos/', '/thumbnails/')
        let dstKey = srcKey.replace(/\.\w+$/, `.jpg`).replace('/videos/', '/thumbnails/')

        var params = {
            ACL: 'public-read',
            Bucket: bucket,
            Key: dstKey,
            Body: tmpFile,
            ContentType: `image/jpg`
        }

        s3.upload(params, function(err, data) {
            
            //console.log(`successful upload to ${bucket}/${dstKey}`)
       
            if(err) 
            {
                resolve({

                    "error"     :err,
                    "result"    :'Image To S3 (FAILED)'
                });

            }else{
    
                resolve({

                    "error"     :false,
                    "result"    :`Image To S3 (SUCCESS) upload to ${bucket}/${dstKey}`
                });

            }//==

        })
        

    })
    //promise
    //=======

}//function
//=========



