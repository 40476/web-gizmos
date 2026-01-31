#!/usr/local/bin/pike

// pic2html v0.5 - converts images into HTML text
// Author: Patrik Roos ( patrik@text-image.com )
// Language: Pike 7.6 ( http://pike.lysator.liu.se/ )


// VARIABLES

// Initialize variables

int timestart = time();                 // Check when script started

int textType_count = -1;                // Start at the beginning
string textType = "sequence";           // Default to sequence
array HTMLcharacter = ({ "0", "1" });   // Default to 0's and 1's
string bgColor = "black";               // Default to black background
int|string fontSize = -3;               // Default to font size -3
int grayscale = 0;                      // Default to colour
string browser = "ie";                  // Default to Internet Explorer
int contrast = 0;                       // Apply contrast curve

// Contrast curve (sine)
array(int) contrastcurve = ({ 0,0,0,0,0,0,0,0,1,1,1,1,1,2,2,2,2,3,3,3,4,4,5,5,6,6,6,7,8,8,9,9,10,10,11,12,12,13,14,14,15,16,17,17,18,19,20,21,22,23,23,24,25,26,27,28,29,30,31,32,33,34,35,37,38,39,40,41,42,43,45,46,47,48,49,51,52,53,54,56,57,58,60,61,62,64,65,66,68,69,71,72,73,75,76,78,79,81,82,84,85,87,88,90,91,93,94,96,97,99,100,102,103,105,106,108,109,111,113,114,116,117,119,120,122,124,125,127,128,130,131,133,135,136,138,139,141,142,144,146,147,149,150,152,153,155,156,158,159,161,162,164,165,167,168,170,171,173,174,176,177,179,180,182,183,184,186,187,189,190,191,193,194,195,197,198,199,201,202,203,204,206,207,208,209,210,212,213,214,215,216,217,218,220,221,222,223,224,225,226,227,228,229,230,231,232,232,233,234,235,236,237,238,238,239,240,241,241,242,243,243,244,245,245,246,246,247,247,248,249,249,249,250,250,251,251,252,252,252,253,253,253,253,254,254,254,254,254,255,255,255,255,255,255,255,255 });


// Some more strings that will be used

string imageURL;
string HTMLheader, beginHTML, endHTML, fontHTMLstart, fontHTMLend;


// FUNCTIONS

// Function to decide what the HTML page should look like

void setHTMLvars() {
        HTMLheader = "<!-- Generated on " + __DATE__ + " using pic2html.cgi, by Patrik Roos -->\n\n";

        beginHTML = "<HTML><HEAD><TITLE>Text image</TITLE></HEAD><BODY>\n";
        endHTML = "</td></tr></table>\n</BODY></HTML>";
        fontHTMLstart = "<font color=";
        fontHTMLend = "</font>";
}


// Function to write an HTML error page

void werr(string errorMessage) {
        setHTMLvars();
        write(HTMLheader + "\n" + beginHTML + "\n");
        write("<table align=center><tr bgcolor=black><td><font color=lightblue size=4>Error: " + errorMessage + "</font></td></tr></table>\n");
        write(endHTML + "\n");
        return;
}


// Function to choose next character for output

string nextCharacter() {
        if (sizeof(HTMLcharacter) == 1) { return HTMLcharacter[0]; }
        if (textType == "random") { return HTMLcharacter[random(sizeof(HTMLcharacter))]; }
        else if (textType == "sequence") {
                textType_count++;
                if (textType_count >= sizeof(HTMLcharacter)) {
                        textType_count = 0;
                        return  HTMLcharacter[0];
                }
                return HTMLcharacter[textType_count];
        }
}


// Main program

int main(int argc, array(string) argv) {
        write("Content-Type: text/html\r\n\r\n");       // Start outputting HTML

        int imageWidth = 130;                           // Default to 130 characters wide

        // Make sure user posted data and that it's not too large
        int temp = (int)getenv("CONTENT_LENGTH");
        if (!temp) {
                werr("No image specified.");
                return 0;
        }

        if (temp > 10485760) {
                werr("Image too large (10MB limit).");
                return 0;
        }

        // Read posted data from user
        string info = Stdio.stdin.read(temp);

        if (strlen(info) < temp) {
                werr("Insufficient data uploaded.");
                return 0;
        }


        // Record the headers used
        mapping(string:string) headies = ([ ]);

        headies["content-type"] = getenv("CONTENT_TYPE");
        headies["content-length"] = getenv("CONTENT_LENGTH");


        string imageData;

        // Put the data into strings to see what settings the user chose
        object msg = MIME.Message( info, headies );

        foreach(msg->body_parts, object food) {


                switch (food->disp_params->name) {

                        case "image":
                                imageURL = food->get_filename();
                                imageData = food->getdata();
                                break;
                        case "textType":
                                textType = food->getdata();
                                break;
                        case "width":
                                imageWidth = (int)(food->getdata());
                                break;
                        case "characters":
                                HTMLcharacter = food->getdata() / "";
                                break;
                        case "bgcolor":
                                bgColor = food->getdata();
                                break;
                        case "fontsize":
                                fontSize = food->getdata();
                                break;
                        case "grayscale":
                                grayscale = (int)(food->getdata());
                                break;
                        case "browser":
                                browser = food->getdata();
                                break;
                        case "contrast":
                                contrast = (int)(food->getdata());
                                break;
                        default:
                                break;
                }

        }

        // Now set the HTML layout
        setHTMLvars();


        // Check if there's been an image submitted, and exit if there hasn't
        if (!imageURL) {
                imageURL = "Error";
                werr("Must specify image.");
                return 0;
        }

        // Check if width is within limits, and force to 100 if not
        if (imageWidth < 1 || imageWidth > 500) { imageWidth = 100; }

        // Create image from data
        Image.Image image;
        mixed imageerror = catch { image = Image.ANY.decode(imageData); };

        // Check if there's been an error creating the image, exit if there has
        if (!image || imageerror) {
                werr("Failed to get image.");
                return 0;
        }

        if (contrast)                                           // Apply contrast curve
                image = image->apply_curve(contrastcurve);

        image = image->scale(imageWidth,0);                     // Resize to fit chosen width

        if (browser == "ie")
                image = image->scale(1.0,0.65);                 // Fix aspect ratio (Internet Explorer)
        else
                image = image->scale(1.0,0.43);                 // Fix aspect ratio (Firefox)

        if (grayscale == 1)
                image = image->grey();
        if (grayscale == 2)
                image = image->grey()->threshold(128,128,128);

        int width = image->xsize();
        int height = image->ysize();

        if (width > 2000 || height > 2000) {
                werror("Image size too large.");
                return 0;
        }

        // Start outputting the HTML page
        if (HTMLheader) { write(HTMLheader); }
        write(beginHTML);

        write("<table align=\"center\" cellpadding=\"10\">\n<tr bgcolor=\"" + bgColor + "\"><td>\n\n<!-- IMAGE BEGINS HERE -->\n<font size=\"" + fontSize + "\">\n<pre>");

        array(int) colours;

        array(int) oldcolours = ({ -1 });               // Set impossible value for previous colours

        // Now for the fun stuff:
        // First we make some loops that will go through each line, one by one.
        // The inner loop will read each pixel's colour and then output the corresponding HTML coloured character
        // It also checks if the last character had the same colour, and if so doesn't output the same colour codes
        //  again, thus saving a few bytes.
        // The outer loop should explain itself.
        for (int y = 0; y < height; y++) {

                for (int x = 0; x < width; x++) {
                        colours = image->getpixel(x,y);
                        if (!equal(colours,oldcolours)) {
                                Image.Color.Color colour = Image.Color.rgb(colours[0],colours[1],colours[2]);
                                if (x == 0)
                                        write(fontHTMLstart + colour->html() + ">" + nextCharacter());
                                else
                                        write(fontHTMLend + fontHTMLstart + colour->html() + ">" + nextCharacter());
                        }
                        else {
                                write(nextCharacter());
                        }

                        oldcolours = colours;
                }

                oldcolours = ({ -1 });
                write(fontHTMLend + "<br>");
        }

        // We're done! Finish up the HTML page, and tell the user how long it took
        write("\n</pre></font>");
        write("\n<!-- IMAGE ENDS HERE -->\n");
        write("\n<P><FONT COLOR=LIGHTBLUE SIZE=2>Rendering time: " + (int)round(time(timestart)) + " seconds.</FONT><BR>\n");

        write(endHTML);

}
